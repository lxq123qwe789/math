from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from models.database import get_db, Group, Record
from pydantic import BaseModel
from typing import List
import random
import re

router = APIRouter(prefix="/api/teacher", tags=["teacher"])

A_GROUP_NUMBERS = {2, 3, 4, 10, 11, 12}
B_GROUP_NUMBERS = {5, 6, 7, 8, 9}
PREFERRED_GROUP_NAMES = ["1组", "2组", "3组", "4组", "5组", "6组", "7组", "8组"]
LEGACY_GROUP_NAMES = ["第一组", "第二组", "第三组", "第四组", "第五组", "第六组", "第七组", "第八组"]
LEGACY_CODE_NAMES = ["202601", "202602", "202603", "202604", "202605", "202606", "202607", "202608"]
VALID_GROUP_NAMES = PREFERRED_GROUP_NAMES + LEGACY_GROUP_NAMES + LEGACY_CODE_NAMES

CHINESE_GROUP_INDEX = {
    "第一组": 1,
    "第二组": 2,
    "第三组": 3,
    "第四组": 4,
    "第五组": 5,
    "第六组": 6,
    "第七组": 7,
    "第八组": 8,
}


def resolve_group_index(name: str) -> int | None:
    if name in CHINESE_GROUP_INDEX:
        return CHINESE_GROUP_INDEX[name]

    match = re.fullmatch(r"([1-8])组", name)
    if match:
        return int(match.group(1))

    match = re.fullmatch(r"20260([1-8])", name)
    if match:
        return int(match.group(1))

    return None


def group_name_priority(name: str) -> int:
    if name in PREFERRED_GROUP_NAMES:
        return 0
    if name in LEGACY_GROUP_NAMES:
        return 1
    if name in LEGACY_CODE_NAMES:
        return 2
    return 3


def get_teacher_groups(db: Session) -> List[Group]:
    candidates = db.query(Group).filter(Group.name.in_(VALID_GROUP_NAMES)).all()
    if not candidates:
        candidates = db.query(Group).order_by(Group.id).all()

    selected_by_index: dict[int, Group] = {}
    for group in candidates:
        group_index = resolve_group_index(group.name)
        if group_index is None:
            continue

        existing = selected_by_index.get(group_index)
        if existing is None:
            selected_by_index[group_index] = group
            continue

        if group_name_priority(group.name) < group_name_priority(existing.name):
            selected_by_index[group_index] = group

    ordered = [selected_by_index[i] for i in range(1, 9) if i in selected_by_index]
    if ordered:
        return ordered

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
    total_times: int = Query(..., ge=1, le=1000000),
):
    if total_times <= 0:
        raise HTTPException(status_code=400, detail="total_times must be greater than 0")

    totals = {number: 0 for number in range(2, 13)}
    for _ in range(total_times):
        total = random.randint(1, 6) + random.randint(1, 6)
        totals[total] += 1

    normalized = [NumberCount(number=n, count=totals[n]) for n in range(2, 13)]
    group_a_total = sum(item.count for item in normalized if item.number in A_GROUP_NUMBERS)
    group_b_total = sum(item.count for item in normalized if item.number in B_GROUP_NUMBERS)

    return SimulationSummary(
        total_times=total_times,
        records=normalized,
        group_a_total=group_a_total,
        group_b_total=group_b_total,
        winner=calculate_winner(group_a_total, group_b_total),
    )
