from fastapi import FastAPI, Depends, HTTPException, status
import fastapi
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import jwt
import socketio
import os
import sys
from pydantic import BaseModel

from config import settings
from models.database import init_db, get_db, User, Group, Record
from routes.student import router as student_router
from routes.teacher import router as teacher_router
from realtime import sio


def enforce_math_environment():
    expected_env = "math"
    active_env = os.getenv("CONDA_DEFAULT_ENV", "")
    executable = (sys.executable or "").lower().replace("\\", "/")
    in_expected_path = f"/envs/{expected_env}/" in executable
    fastapi_path = (getattr(fastapi, "__file__", "") or "").lower().replace("\\", "/")
    fastapi_in_expected_path = f"/envs/{expected_env}/" in fastapi_path

    if active_env != expected_env and not in_expected_path:
        raise RuntimeError(
            f"Backend must run in conda environment '{expected_env}'. "
            f"Current CONDA_DEFAULT_ENV='{active_env or 'N/A'}', python='{sys.executable}'"
        )

    if not fastapi_in_expected_path:
        raise RuntimeError(
            "Detected user-site package precedence. Please run backend with 'python -s' "
            f"or set PYTHONNOUSERSITE=1. Current fastapi path: '{getattr(fastapi, '__file__', 'N/A')}'"
        )


enforce_math_environment()

# Initialize database
init_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = next(get_db())
    try:
        init_default_users(db)
        print("✓ Database initialized with default users and groups")
    finally:
        db.close()
    yield

# Create FastAPI app
fastapi_app = FastAPI(
    title="Math Teaching Interactive System",
    description="Probability and Statistics Interactive Teaching Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str
    role: str
    group_id: int | None = None


# Helper functions
def verify_password(plain_password: str, stored_password: str) -> bool:
    return plain_password == stored_password


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def get_current_user(token: str, db: Session = Depends(get_db)):
    """Validate JWT token and return user"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user


def init_default_users(db: Session):
    """Initialize default users if they don't exist"""
    group_labels = ["1组", "2组", "3组", "4组", "5组", "6组", "7组", "8组"]

    # Admin user
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            password="admin123",
            role="admin"
        )
        db.add(admin)
    else:
        admin.password = "admin123"
    db.commit()
    
    # Create groups
    groups = {}
    for i in range(1, 9):
        old_group_name = f"20260{i}"
        group_name = group_labels[i - 1]
        group = db.query(Group).filter(Group.name == group_name).first()
        if not group:
            group = db.query(Group).filter(Group.name == old_group_name).first()
            if group:
                group.name = group_name
        if not group:
            group = Group(name=group_name)
            db.add(group)
            db.flush()
        groups[group_name] = group.id
    db.commit()
    
    # Student users
    for i in range(1, 9):
        old_username = f"20260{i}"
        username = group_labels[i - 1]
        student = db.query(User).filter(User.username == username).first()
        if not student:
            student = db.query(User).filter(User.username == old_username).first()
            if student:
                student.username = username
        if not student:
            group_id = groups.get(username)
            if not group_id:
                continue
            student = User(
                username=username,
                password="12345678",
                role="student",
                group_id=group_id
            )
            db.add(student)
        else:
            student.password = "12345678"
            if groups.get(username):
                student.group_id = groups[username]
    db.commit()


# Include routers
fastapi_app.include_router(student_router)
fastapi_app.include_router(teacher_router)


@sio.event
async def connect(sid, environ, auth):
    print(f"[socket] connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[socket] disconnected: {sid}")


# Public routes (no authentication required)
@fastapi_app.post("/api/auth/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login endpoint - returns JWT token"""
    user = db.query(User).filter(User.username == request.username).first()
    
    if not user or not verify_password(request.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        username=user.username,
        role=user.role,
        group_id=user.group_id
    )


@fastapi_app.post("/api/auth/register")
async def register(request: LoginRequest, db: Session = Depends(get_db)):
    """Register a new student (for testing purposes)"""
    user = db.query(User).filter(User.username == request.username).first()
    
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    new_user = User(
        username=request.username,
        password=request.password,
        role="student"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "user_id": new_user.id,
        "username": new_user.username,
        "message": "Registration successful"
    }


@fastapi_app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat()
    }


# Root endpoint
@fastapi_app.get("/")
async def root():
    return {
        "name": "Math Teaching Interactive System",
        "version": "1.0.0",
        "status": "running"
    }


app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
