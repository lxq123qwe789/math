from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from models.database import get_db, Group, Record
from pydantic import BaseModel
from typing import List
import numpy as np

router = APIRouter(prefix="/api/teacher", tags=["teacher"])

A_GROUP_NUMBERS = {2, 3, 4, 10, 11, 12}
B_GROUP_NUMBERS = {5, 6, 7, 8, 9}
DICE_SUM_PROBABILITIES = np.array([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1], dtype=np.float64) / 36.0
GROUP_SUFFIX = "\u7ec4"  # group suffix: 组
PREFERRED_GROUP_NAMES = [f"{i}{GROUP_SUFFIX}" for i in range(1, 9)]


def group_name_index(name: str) -> int:
    for i in range(1, 9):
        if name == f"{i}{GROUP_SUFFIX}":
            return i
    return 999


def get_teacher_groups(db: Session) -> List[Group]:
    groups = db.query(Group).filter(Group.name.in_(PREFERRED_GROUP_NAMES)).all()
    groups = sorted(groups, key=lambda g: group_name_index(g.name))

    if groups:
        return groups

    fallback = db.query(Group).order_by(Group.id).all()
    return fallback[:8]


class NumberCount(BaseModel):
    number: int
    count: int


class GroupOverview(BaseModel):
    group_id: int
    group_name: str
    records: List[NumberCount]
    group_a_total: int
    group_b_total: int
    winner: str


class ClassSummary(BaseModel):
    records: List[NumberCount]
    group_a_total: int
    group_b_total: int
    winner: str


class SimulationSummary(BaseModel):
    total_times: int
    records: List[NumberCount]
    group_a_total: int
    group_b_total: int
    winner: str


def calculate_winner(group_a_total: int, group_b_total: int) -> str:
    if group_a_total > group_b_total:
        return "A"
    if group_b_total > group_a_total:
        return "B"
    return "Tie"


def build_groups_overview(groups: List[Group], db: Session) -> List[GroupOverview]:
    group_ids = [group.id for group in groups]

    records = []
    if group_ids:
        records = (
            db.query(Record)
            .filter(Record.group_id.in_(group_ids))
            .order_by(Record.group_id, Record.number)
            .all()
        )

    record_map: dict[int, dict[int, int]] = {group_id: {} for group_id in group_ids}
    for record in records:
        record_map.setdefault(record.group_id, {})[record.number] = record.count

    result: List[GroupOverview] = []

    for group in groups:
        number_map = record_map.get(group.id, {})
        normalized = [NumberCount(number=n, count=number_map.get(n, 0)) for n in range(2, 13)]

        group_a_total = sum(item.count for item in normalized if item.number in A_GROUP_NUMBERS)
        group_b_total = sum(item.count for item in normalized if item.number in B_GROUP_NUMBERS)

        result.append(
            GroupOverview(
                group_id=group.id,
                group_name=group.name,
                records=normalized,
                group_a_total=group_a_total,
                group_b_total=group_b_total,
                winner=calculate_winner(group_a_total, group_b_total),
            )
        )

    return result


@router.get("/groups-overview", response_model=List[GroupOverview])
async def get_groups_overview(db: Session = Depends(get_db)):
    groups = get_teacher_groups(db)
    return build_groups_overview(groups, db)


@router.get("/groups-overview-delta", response_model=List[GroupOverview])
async def get_groups_overview_delta(
    group_ids: List[int] = Query(default=[]),
    db: Session = Depends(get_db)
):
    groups = get_teacher_groups(db)
    if group_ids:
        target_ids = {group_id for group_id in group_ids if group_id > 0}
        groups = [group for group in groups if group.id in target_ids]

    if not groups:
        return []

    return build_groups_overview(groups, db)


@router.get("/class-summary", response_model=ClassSummary)
async def get_class_summary(db: Session = Depends(get_db)):
    valid_group_ids = {group.id for group in get_teacher_groups(db)}
    records = db.query(Record).filter(Record.group_id.in_(valid_group_ids)).all()

    totals = {number: 0 for number in range(2, 13)}
    for record in records:
        if record.number in totals:
            totals[record.number] += record.count

    normalized = [NumberCount(number=n, count=totals[n]) for n in range(2, 13)]
    group_a_total = sum(item.count for item in normalized if item.number in A_GROUP_NUMBERS)
    group_b_total = sum(item.count for item in normalized if item.number in B_GROUP_NUMBERS)

    return ClassSummary(
        records=normalized,
        group_a_total=group_a_total,
        group_b_total=group_b_total,
        winner=calculate_winner(group_a_total, group_b_total),
    )


@router.post("/simulate", response_model=SimulationSummary)
async def simulate_dice(
    total_times: int = Query(..., ge=1),
):
    if total_times <= 0:
        raise HTTPException(status_code=400, detail="total_times must be greater than 0")

    counts = np.random.multinomial(total_times, DICE_SUM_PROBABILITIES)

    normalized = [NumberCount(number=n, count=int(counts[n - 2])) for n in range(2, 13)]
    group_a_total = sum(item.count for item in normalized if item.number in A_GROUP_NUMBERS)
    group_b_total = sum(item.count for item in normalized if item.number in B_GROUP_NUMBERS)

    return SimulationSummary(
        total_times=total_times,
        records=normalized,
        group_a_total=group_a_total,
        group_b_total=group_b_total,
        winner=calculate_winner(group_a_total, group_b_total),
    )
