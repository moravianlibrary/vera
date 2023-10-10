from sqlalchemy.orm import Session
from sqlalchemy import desc, select
from typing import Optional

import models, schemas


def create_user(db: Session,
                user: schemas.UserCreate):
    db_user = models.User(
        username=user.username,
        password=user.password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_username(db: Session,
                         username: str):
    return db.query(models.User).filter(models.User.username == username).first()


def get_users_num_found(db: Session):
    return db.query(models.User).count()


def get_users(db: Session,
              offset: int,
              limit: int):
    return db.query(models.User).offset(offset).limit(limit).all()


def get_user(db: Session,
             user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_roles(db: Session,
                   user_id: int):
    return db.query(models.UserRole.user_role).join(models.User).filter(models.User.id == user_id).all()


def update_user(db: Session,
                user: schemas.User):
    # db_user = models.User(
    #     id=user.id,
    #     username=user.username,
    #     department=user.department
    # )
    # db.execute(update(models.User).where(models.User.id == user.id).values(models.User.department = user.department))
    # db.commit()
    return get_user(db, user.id)


def update_user_password(db: Session,
                         user_id: int,
                         user_change_password: schemas.UserChangePassword):
    db_user = models.User(
        id=user_id,
        password=user_change_password.new_password
    )
    db.update(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_record(db: Session, record_id: int):
    return db.query(models.Record).filter(models.Record.id == record_id).first()


def get_records(db: Session, offset: int = 0, limit: int = 100, sysno: Optional[str] = None):
    return db.query(models.RecordView)\
    .filter(sysno is None or models.RecordView.sysno == sysno)\
    .order_by(desc(models.RecordView.created_at))\
    .offset(offset).limit(limit).all()


def get_records_num_found(db: Session, sysno: Optional[str] = None):
    return db.query(models.Record)\
    .filter(sysno is None or models.Record.sysno == sysno)\
    .count()


def create_record(db: Session, record: schemas.RecordCreate, user: schemas.User):
    db_record = models.Record(
        sysno=record.sysno, 
        volume_number=record.volume_number, 
        item_number=record.item_number, 
        category=record.category,
        title=record.title,
        pages_count=record.pages_count,
        creator_id=user.id
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_note(db: Session, record_id: int, user_id: int):
    return db.query(models.Record)\
    .filter(models.Note.record_id == record_id and models.Note.user_id == user_id)\
    .first()


def get_notes_for_record(db: Session, record_id: int, offset: int = 0, limit: int = 100):
    return db.query(models.Note)\
    .filter(models.Note.record_id == record_id)\
    .offset(offset).limit(limit).all()


def create_note(db: Session, note: schemas.NoteCreate):
    db_note = models.Note(
        record_id=note.record_id,
        user_id=note.user_id,
        note_text=note.note_text
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note