from sqlalchemy.orm import Session
from typing import Optional

import models, schemas


def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_users(db: Session, offset: int = 0, limit: int = 100):
    return db.query(models.User).offset(offset).limit(limit).all()


def create_user(db: Session, user: schemas.UserCreate):
    fake_hashed_password = user.password + "notreallyhashed"
    db_user = models.User(email=user.email, hashed_password=fake_hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_record(db: Session, record_id: int):
    return db.query(models.Record).filter(models.Record.id == record_id).first()


def get_records(db: Session, offset: int = 0, limit: int = 100, sysno: Optional[str] = None):
    return db.query(models.Record)\
    .filter(sysno is None or models.Record.sysno == sysno)
    .offset(offset).limit(limit).all()


def create_record(db: Session, record: schemas.RecordCreate):
    db_record = models.Record(
        sysno=record.sysno, 
        volume_number=record.volume_number, 
        item_number=record.item_number, 
        creator=record.creator
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_note(db: Session, record_id: int, user_id: int):
    return db.query(models.Record)\
    .filter(models.Note.record_id == record_id and models.Note.user_id == user_id)\
    .first()


def get_notes_for_record(db: Session, offset: int = 0, limit: int = 100, record_id: int):
    return db.query(models.Note)\
    .filter(models.Note.record_id == record_id)
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