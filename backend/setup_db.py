#!/usr/bin/env python3
"""快速初始化数据库脚本"""

from sqlalchemy import create_engine, text
import sys

print("="*70)
print("数据库初始化")
print("="*70)

# 连接参数
DB_USER = "postgres"
DB_PASSWORD = "2833210"
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "math_teaching"

print(f"\n📍 连接参数:")
print(f"   用户: {DB_USER}")
print(f"   主机: {DB_HOST}:{DB_PORT}")
print(f"   数据库: {DB_NAME}")

# 第一步：连接到 postgres 数据库并创建 math_teaching 数据库
print(f"\n1️⃣  连接到 PostgreSQL...")
try:
    from sqlalchemy import event
    engine_default = create_engine(
        f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/postgres",
        isolation_level="AUTOCOMMIT"
    )
    with engine_default.connect() as conn:
        # 检查数据库是否存在
        result = conn.execute(text(
            "SELECT 1 FROM pg_database WHERE datname = 'math_teaching'"
        ))
        
        if not result.fetchone():
            print(f"   创建数据库: {DB_NAME}...")
            conn.execute(text(f"CREATE DATABASE {DB_NAME}"))
            print(f"   ✓ 数据库创建成功")
        else:
            print(f"   ✓ 数据库已存在: {DB_NAME}")
            
except Exception as e:
    print(f"   ✗ 连接失败: {e}")
    sys.exit(1)

# 第二步：连接到目标数据库并创建表
print(f"\n2️⃣  初始化表格...")
try:
    from models.database import init_db
    init_db()
    print(f"   ✓ 表格创建成功")
except Exception as e:
    print(f"   ✗ 创建表格失败: {e}")
    sys.exit(1)

# 第三步：创建默认用户和分组
print(f"\n3️⃣  创建默认用户和分组...")
try:
    from models.database import SessionLocal, User, Group, Record
    
    db = SessionLocal()
    
    # 创建分组
    for i in range(1, 9):
        group_name = f"20260{i}"
        existing = db.query(Group).filter(Group.name == group_name).first()
        if not existing:
            group = Group(name=group_name)
            db.add(group)
    db.commit()
    print(f"   ✓ 创建 8 个学生分组 (202601-202608)")
    
    # 创建管理员用户
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
    print(f"   ✓ 创建管理员账户 (admin / admin123)")
    
    # 创建学生用户
    for i in range(1, 9):
        username = f"20260{i}"
        existing = db.query(User).filter(User.username == username).first()
        if not existing:
            group = db.query(Group).filter(Group.name == username).first()
            student = User(
                username=username,
                password="12345678",
                role="student",
                group_id=group.id if group else None
            )
            db.add(student)
        else:
            existing.password = "12345678"
    db.commit()
    print(f"   ✓ 创建 8 个学生账户 (202601-202608 / 12345678)")
    
    # 初始化记录
    for i in range(1, 9):
        group = db.query(Group).filter(Group.name == f"20260{i}").first()
        if group:
            for num in range(2, 13):
                existing = db.query(Record).filter(
                    Record.group_id == group.id,
                    Record.number == num
                ).first()
                if not existing:
                    record = Record(group_id=group.id, number=num, count=0)
                    db.add(record)
    db.commit()
    db.close()
    print(f"   ✓ 初始化所有记录 (每组 11 条记录：2-12)")
    
except Exception as e:
    print(f"   ✗ 创建用户失败: {e}")
    sys.exit(1)

print(f"\n" + "="*70)
print(f"✅ 数据库初始化成功！")
print(f"="*70)
print(f"\n🔐 默认账号:")
print(f"   教师: admin / admin123")
print(f"   学生: 202601-202608 / 12345678")
print(f"\n🚀 接下来可以启动应用:")
print(f"   后端: python app.py")
print(f"   前端: npm run dev")
print("="*70)
