#!/usr/bin/env python3
"""Initialize database with groups/users 1-8 only (no admin)."""

from models.database import init_db, SessionLocal, User, Group, Record


def sync_groups_and_users(db):
    group_suffix = "\u7ec4"  # 组
    group_labels = [f"{i}{group_suffix}" for i in range(1, 9)]

    groups: dict[str, int] = {}
    for group_name in group_labels:
        group = db.query(Group).filter(Group.name == group_name).first()
        if not group:
            group = Group(name=group_name)
            db.add(group)
            db.flush()
        groups[group_name] = group.id

    db.commit()

    # Delete any non-canonical groups and move related data to canonical groups when possible.
    all_groups = db.query(Group).order_by(Group.id).all()
    for group in all_groups:
        if group.name in groups:
            continue

        db.query(User).filter(User.group_id == group.id).update(
            {User.group_id: None},
            synchronize_session=False,
        )
        db.query(Record).filter(Record.group_id == group.id).delete(synchronize_session=False)
        db.delete(group)

    db.commit()

    # Remove admin account(s)
    db.query(User).filter((User.role == "admin") | (User.username == "admin")).delete(synchronize_session=False)
    db.commit()

    required_teachers = {
        "\u848b\u4f73\u9091": ("admin123", "teacher"),  # 蒋佳邑
    }

    # Ensure 8 student users.
    for i in range(1, 9):
        username = f"{i}{group_suffix}"
        student = db.query(User).filter(User.username == username).first()
        if not student:
            student = User(
                username=username,
                password="12345678",
                role="student",
                group_id=groups[username],
            )
            db.add(student)
        else:
            student.password = "12345678"
            student.role = "student"
            student.group_id = groups[username]

    db.commit()

    # Ensure required teacher users exist.
    for username, (password, role) in required_teachers.items():
        teacher = db.query(User).filter(User.username == username).first()
        if not teacher:
            teacher = User(
                username=username,
                password=password,
                role=role,
                group_id=None,
            )
            db.add(teacher)
        else:
            teacher.password = password
            teacher.role = role
            teacher.group_id = None

    db.commit()

    allowed_usernames = set(group_labels) | set(required_teachers.keys())
    db.query(User).filter(~User.username.in_(allowed_usernames)).delete(synchronize_session=False)
    db.commit()

    # Ensure records exist for each group and number 2-12.
    for i in range(1, 9):
        group = db.query(Group).filter(Group.name == f"{i}{group_suffix}").first()
        if not group:
            continue
        for num in range(2, 13):
            existing = db.query(Record).filter(Record.group_id == group.id, Record.number == num).first()
            if not existing:
                db.add(Record(group_id=group.id, number=num, count=0))
    db.commit()


def main():
    print("=" * 60)
    print("Initialize DB for 1-8 groups students (no admin)")
    print("=" * 60)

    init_db()
    db = SessionLocal()
    try:
        sync_groups_and_users(db)

        users = db.query(User).order_by(User.id).all()
        groups = db.query(Group).order_by(Group.id).all()

        print("\nGroups:")
        for g in groups:
            print(f"  - {g.id}: {g.name}")

        print("\nUsers:")
        for u in users:
            print(f"  - {u.id}: {u.username} ({u.role}), group_id={u.group_id}")

        print("\nDone.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
