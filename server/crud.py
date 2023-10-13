from sqlalchemy.orm import Session
from sqlalchemy import desc, func, select
from typing import Optional

from database import create
import models, schemas


def create_role(db: Session,
                role: schemas.RoleBase):
    return (db, models.Role(
        name=role.name
    ))


def update_role(db: Session,
            role: schemas.RoleBase):
    db.execute(update(models.Role).where(models.Role.id == role.id)
        .values(name=role.name))


def delete_role(db: Session,
                role_id: int):
    db.delete(models.Role).where(models.Role.id == role_id)


def get_roles(db: Session):
    return db.query(models.Role).all()


def get_role_actions(db: Session,
                     role_id: int):
    return db.query(models.Action).filter(models.Action.role_id == role_id).first()


def update_role_actions(db: Session,
                        role_actions: schemas.RoleActions):
    db.delete(models.Action).where(models.Action.role_id == role_actions.id)

    for action in role_actions.actions:
        create(db, models.Action(
            role_id=role_actions.id,
            action_type=action.action_type,
            action_scope=action.action_scope
        ))
    
    db.commit()
    return 


def create_department(db: Session,
                      department: schemas.DepartmentBase):
    return create(db, models.Department(
        abbreviation=department.abbreviation,
        name=department.name
    ))


def update_department(db: Session,
                      department: schemas.DepartmentBase):
    db.execute(update(models.Department).where(models.Department.id == department.id)
            .values(abbreviation = department.abbreviation)
            .values(name = role.name))


def delete_department(db: Session,
                      department_id: int):
    db.delete(models.Department).where(models.Department.id == department_id)


def get_departments(db: Session):
    return db.query(models.Department).all()


def create_user(db: Session,
                user_create: schemas.UserCreate):
    return (db, models.User(
        username=user_create.username,
        password=user_create.password
    ))


def get_user_by_username(db: Session,
                         username: str):
    return db.query(models.User).filter(models.User.username == username).first()


def get_user(db: Session,
             user_id: int):
    return db.query(models.UserInfoView).filter(models.User.id == user_id).first()


def get_user_actions(db: Session,
                     user_id: int):
    return db.query(models.UserActionsView).filter(models.User.id == user_id).all()


def update_user(db: Session,
                user: schemas.User):
    db.execute(update(models.User).where(models.User.id == user.user.id)
            .values(username = user.username)
            .values(department_id = user.department_id)
            .values(role_id = user.role_id))
    db.commit()
    return get_user(db, user.id)


def update_user_password(db: Session,
                         user_change_password: schemas.UserChangePassword):
    db.execute(update(models.User).where(models.User.id == user_change_password.id)
            .values(password = user_change_password.new_password))
    db.commit()
    return get_user(db, user_id)


def delete_user(db: Session,
                user_id: int):
    db.delete(models.User).where(models.User.id == user_id)


def get_users(db: Session,
              department_id: Optional[int] = None,
              role_id: Optional[int] = None,
              offset: int = 0,
              limit: int = 100):
    q = db.query(models.UserInfoView)

    if department_id is not None:
        q = q.filter(models.User.department_id == department_id)
    if role_id is not None:
        q = q.filter(models.User.role_id == role_id)
    
    return q.offset(offset).limit(limit).all()


def get_users_num_found(db: Session,
                        department_id: Optional[int] = None,
                        role_id: Optional[int] = None):
    q = db.query(models.UserInfoView)

    if department_id is not None:
        q = q.filter(models.User.department_id == department_id)
    if role_id is not None:
        q = q.filter(models.User.role_id == role_id)

    return q.count()


def create_category(db: Session,
                    category_create: schemas.CategoryCreate):
    create(db, models.Category(
        name=category_create.name
    ))


def update_category(db: Session,
                    category: schemas.Category):
    create(db, models.Category(
        name=category_create.name
    ))


def delete_category(db: Session,
                    category_id: int):
    db.delete(models.Category).where(models.Category.id == category_id)


def get_categories(db: Session):
    return db.query(models.Category).all()


def create_record(db: Session,
                  record: schemas.Record,
                  user: schemas.User):
    return create(db, models.Record(
        sysno=record.sysno,
        volume_number=record.volume_number,
        item_number=record.item_number,
        category_id=record.category_id,
        title=record.title,
        pages_count=record.pages_count,
        signature=record.signature,
        issn=record.issn,
        isbn=record.isbn,
        barcode=record.barcode,
        creator_id=user.id
    ))


def get_record(db: Session,
               record_id: int):
    return db.query(models.Record).filter(models.Record.id == record_id).first()


def update_record(db: Session,
                  record: schemas.Record,
                  user: schemas.User):
    db_record = get_record(db, record.id)
    
    if not record:
        return

    db_record.sysno=record.sysno
    db_record.volume_number=record.volume_number
    db_record.item_number=record.item_number
    db_record.category_id=record.category_id
    db_record.title=record.title
    db_record.pages_count=record.pages_count
    db_record.signature=record.signature
    db_record.issn=record.issn
    db_record.isbn=record.isbn
    db_record.barcode=record.barcode

    db.commit()
    db.refresh(db_record)
    return db_record


def delete_record(db: Session,
                  record_id: int):
    db.delete(models.Record).where(models.Record.id == record_id)


def get_records(db: Session,
                sysno: Optional[str] = None,
                offset: int = 0, 
                limit: int = 100):
    q = db.query(models.Record)

    if sysno is not None:
        q = q.filter(models.Record.sysno == sysno)
    
    return q.order_by(desc(models.RecordView.created_at))\
    .offset(offset).limit(limit).all()


def get_records_num_found(db: Session,
                          sysno: Optional[str] = None):
    q = db.query(models.Record)

    if sysno is not None:
        q = q.filter(models.Record.sysno == sysno)

    return q.count()


def create_comment(db: Session,
                   comment: schemas.CommentCreate):
    return create(db, models.Comment(
        record_id=comment.record_id,
        user_id=comment.user_id,
        text=comment.text
    ))


def update_comment(db: Session,
                   comment: schemas.Comment):
    db.execute(update(models.Comment).where(models.Comment.id == comment.id)
            .values(text = comment.text)
            .values(edited_at = func.now()))


def delete_comment(db: Session,
                   comment_id: int):
    db.delete(models.Comment).where(models.Comment.id == comment_id)


def get_comment(db: Session,
                record_id: int,
                user_id: int):
    return db.query(models.Record)\
    .filter(models.Comment.record_id == record_id and models.Comment.user_id == user_id)\
    .first()


def get_comments_for_record(db: Session,
                            record_id: int):
    return db.query(models.Comment).all()


def craete_extraction(db: Session,
                      extraction: schemas.ExtractionCreate,
                      user: schemas.User):
    if not extraction.extracted_records:
        return

    db_extraction = create(db, models.Extraction(
        extractor_id=user.id
    ))

    for record_id in extraction.extracted_records:
        db.execute(update(models.Record).where(models.Record.id == record_id)
            .values(extraction_id = db_extraction.id))
