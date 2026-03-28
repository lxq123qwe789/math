from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.database import get_db, Record, Group, User
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from realtime import broadcast_data_updated

router = APIRouter(prefix="/api/student", tags=["student"])

# Pydantic models
class RecordUpdate(BaseModel):
    number: int  # 2-12
    action: str  # "increment" or "decrement"


class RecordResponse(BaseModel):
    number: int
    count: int

    class Config:
        from_attributes = True


class GroupDataResponse(BaseModel):
    group_id: int
    group_name: str
    records: List[RecordResponse]
    group_a_total: int
    group_b_total: int
    winner: str  # "A", "B", or "Tie"


# Helper function to get or create records for a group
def ensure_group_records(group_id: int, db: Session):
    """Ensure all numbers 2-12 have records for this group"""
    for num in range(2, 13):
        existing = db.query(Record).filter(
            and_(Record.group_id == group_id, Record.number == num)
        ).first()
        if not existing:
            record = Record(group_id=group_id, number=num, count=0)
            db.add(record)
    db.commit()


# Helper function to calculate statistics
def calculate_stats(records: List[Record]):
    """Calculate A group, B group totals and winner"""
    group_a = [2, 3, 4, 10, 11, 12]
    group_b = [5, 6, 7, 8, 9]

    group_a_total = sum(r.count for r in records if r.number in group_a)
    group_b_total = sum(r.count for r in records if r.number in group_b)
    
    if group_a_total > group_b_total:
        winner = "A"
    elif group_b_total > group_a_total:
        winner = "B"
    else:
        winner = "Tie"
    
    return group_a_total, group_b_total, winner


@router.post("/update")
async def update_record(
    group_id: int,
    number: int,
    action: str,
    db: Session = Depends(get_db)
):
    """
    Update record count: increment or decrement
    number: 2-12
    action: "increment" or "decrement"
    """
    # Validate input
    if number < 2 or number > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Number must be between 2 and 12"
        )
    
    if action not in ["increment", "decrement"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be 'increment' or 'decrement'"
        )

    # Keep total limit for the group
    group_records = db.query(Record).filter(Record.group_id == group_id).all()
    total_count = sum(r.count for r in group_records)
    if action == "increment" and total_count >= 40:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该组总次数已达到40次，不能继续增加"
        )
    
    # Get or create record
    record = db.query(Record).filter(
        and_(Record.group_id == group_id, Record.number == number)
    ).first()
    
    if not record:
        record = Record(group_id=group_id, number=number, count=0)
        db.add(record)
        db.flush()
    
    # Prevent negative counts
    if action == "decrement" and record.count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Count cannot be negative"
        )
    
    # Update count
    if action == "increment":
        record.count += 1
    else:
        record.count -= 1
    
    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)

    await broadcast_data_updated(group_id)
    
    return {
        "success": True,
        "number": record.number,
        "count": record.count,
        "message": f"Number {number} updated to {record.count}"
    }


@router.get("/group/{group_id}/data")
async def get_group_data(group_id: int, db: Session = Depends(get_db)):
    """Get all data for a group"""
    # Ensure records exist
    ensure_group_records(group_id, db)
    
    # Get all records for this group
    records = db.query(Record).filter(Record.group_id == group_id).order_by(Record.number).all()
    
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or no records"
        )
    
    # Get group name
    group = db.query(Group).filter(Group.id == group_id).first()
    group_name = group.name if group else f"Group {group_id}"
    
    # Calculate statistics
    group_a_total, group_b_total, winner = calculate_stats(records)
    
    # Prepare response
    record_list = [RecordResponse(number=r.number, count=r.count) for r in records]
    
    return GroupDataResponse(
        group_id=group_id,
        group_name=group_name,
        records=record_list,
        group_a_total=group_a_total,
        group_b_total=group_b_total,
        winner=winner
    )


@router.post("/group/{group_id}/reset")
async def reset_group_data(group_id: int, db: Session = Depends(get_db)):
    """Reset all data for a group"""
    records = db.query(Record).filter(Record.group_id == group_id).all()
    for record in records:
        record.count = 0
        record.updated_at = datetime.utcnow()
    
    db.commit()

    await broadcast_data_updated(group_id)
    
    return {
        "success": True,
        "message": f"Group {group_id} data has been reset"
    }
