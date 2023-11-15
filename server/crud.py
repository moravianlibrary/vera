from sqlalchemy.orm import Session
from sqlalchemy import desc, func, update, select
from typing import List, Optional

from services.database import create
from enums import ActionType
import models, schemas


def create_role(role: schemas.RoleBase,
                db: Session):
    return create(db, models.Role(
        name=role.name
    ))


def create_role_actions(role_id: int,
                        actions: List[ActionType],
                        db: Session):
    for action in actions:
        create(db, models.Action(
            role_id=role_id,
            action=action,
        ))
    db.commit()


def update_role(role: schemas.Role,
                db: Session):
    db.execute(update(models.Role)
               .where(models.Role.id == role.id)
               .values(name=role.name))
    return db.query(models.Role).filter(models.Role.id == role.id).first()


def update_role_actions(role: schemas.Role,
                        db: Session):
    actions_to_delete = db.query(models.Action).filter(models.Action.role_id == role.id).all()
    for action in actions_to_delete:
        db.delete(action)
    create_role_actions(role.id, role.actions, db)


def delete_role(role_id: int,
                db: Session):
    actions_to_delete = db.query(models.Action).filter(models.Action.role_id == role_id).all()
    for action in actions_to_delete:
        db.delete(action)

    db_role = db.query(models.Role).where(models.Role.id == role_id).first()
    db.delete(db_role)

    db.commit()
    return db_role


def get_role(role_id: int,
             db: Session):
    return db.query(models.Role).filter(models.Role.id == role_id).first()


def get_role_actions(role_id: int,
                     db: Session):
    return db.query(models.Action.action).filter(models.Action.role_id == role_id).all()


def get_roles(db: Session):
    return db.query(models.Role).order_by(models.Role.name).all()


def create_department(department: schemas.DepartmentBase,
                      db: Session):
    return create(db, models.Department(
        abbreviation=department.abbreviation,
        name=department.name
    ))


def update_department(department: schemas.DepartmentBase,
                      db: Session):
    db.execute(update(models.Department).where(models.Department.id == department.id)
            .values(abbreviation = department.abbreviation)
            .values(name = department.name))
    db.commit()


def delete_department(department_id: int,
                      db: Session):
    db_department = db.query(models.Department).where(models.Department.id == department_id).first()
    db.delete(db_department)
    db.commit()
    return db_department


def get_departments(db: Session):
    return db.query(models.Department).all()


def create_user(user_create: schemas.UserCreate,
                db: Session):
    return create(db, models.User(
        username=user_create.username,
        password=user_create.password
    ))


def get_user_by_username(username: str,
                         db: Session):
    return db.query(models.User).filter(models.User.username == username).first()


def get_user(user_id: int,
             db: Session):
    return db.query(models.UserView).filter(models.UserView.id == user_id).first()


def get_user_actions(user_id: int,
                     db: Session):
    return db.query(models.UserActionsView).filter(models.User.id == user_id).all()


def update_user(user: schemas.User,
                db: Session):
    db.execute(update(models.User).where(models.User.id == user.id)
            .values(username = user.username)
            .values(department_id = user.department_id)
            .values(role_id = user.role_id))
    db.commit()
    return get_user(user.id, db)


def update_user_password(user_change_password: schemas.UserChangePassword,
                         db: Session):
    db.execute(update(models.User).where(models.User.id == user_change_password.id)
            .values(password = user_change_password.new_password))
    db.commit()
    return get_user(user_change_password.id, db)


def delete_user(user_id: int,
                db: Session):
    db_user = db.query(models.User).where(models.User.id == user_id).first()
    db.delete(db_user)
    db.commit()
    return db_user


def get_users(db: Session,
              department_id: Optional[int] = None,
              role_id: Optional[int] = None,
              offset: int = 0,
              limit: int = 100):
    q = db.query(models.UserView)

    if department_id is not None:
        q = q.filter(models.UserView.department_id == department_id)
    if role_id is not None:
        q = q.filter(models.UserView.role_id == role_id)
    
    return q.offset(offset).limit(limit).all()


def get_users_num_found(db: Session,
                        department_id: Optional[int] = None,
                        role_id: Optional[int] = None):
    q = db.query(models.UserView)

    if department_id is not None:
        q = q.filter(models.UserView.department_id == department_id)
    if role_id is not None:
        q = q.filter(models.UserView.role_id == role_id)

    return q.count()


def create_category(category_create: schemas.CategoryCreate,
                    db: Session):
    return create(db, models.Category(
        name=category_create.name
    ))


def update_category(category: schemas.Category,
                    db: Session):
    db.execute(update(models.Category).where(models.Category.id == category.id)
            .values(name = category.name))
    db.commit()
    return db.query(models.Category).where(models.Category.id == category.id).first()


def delete_category(category_id: int,
                    db: Session):
    db_category = db.query(models.Category).where(models.Category.id == category_id).first()
    db.delete(db_category)
    db.commit()
    return db_category


def get_categories(db: Session):
    return db.query(models.Category).all()


def create_record(record: schemas.Record,
                  user: schemas.User,
                  db: Session):
    db_record = create(db, models.Record(
        sysno=record.sysno,
        volume_number=record.volume_number,
        item_number=record.item_number,
        category_id=record.category_id,
        material_type=record.material_type,
        title=record.title,
        publishers=record.publishers,
        pages_count=record.pages_count,
        size=record.size,
        signature=record.signature,
        barcode=record.barcode,
        ccnb=record.ccnb,
        isbn=record.isbn,
        creator_id=user.id
    ))
    return get_record(db_record.id, db)


def update_record(record_id: int,
                  record: schemas.RecordCreate,
                  user: schemas.User,
                  db: Session):
    db_record = db.query(models.Record).filter(models.Record.id == record_id).first()
    
    if not record:
        return

    db_record.sysno=record.sysno
    db_record.volume_number=record.volume_number
    db_record.item_number=record.item_number
    db_record.category_id=record.category_id
    db_record.material_type=record.material_type
    db_record.title=record.title
    db_record.pages_count=record.pages_count
    db_record.size=record.size
    db_record.barcode=record.barcode
    db_record.signature=record.signature
    db_record.ccnb=record.ccnb
    db_record.isbn=record.isbn

    db.commit()

    return get_record(record_id, db)


def delete_record(record_id: int,
                  db: Session):
    db_record = db.query(models.Record).where(models.Record.id == record_id).first()
    db.delete(db_record)
    db.commit()
    return db_record


def get_record(record_id: int,
               db: Session):
    return db.query(models.RecordView).filter(models.RecordView.id == record_id).first()


def get_record_by_identifiers(sysno: str,
                              volume_number: Optional[str],
                              item_number: Optional[str],
                              db: Session):
    query_base = db.query(models.Record).filter(models.Record.sysno == sysno)
    if volume_number:
        query_base = query_base.filter(models.Record.volume_number == volume_number)
    if item_number:
        query_base = query_base.filter(models.Record.item_number == item_number)
    return query_base.first()


def get_records_query_base(db: Session,
                           sysno: Optional[str] = None,
                           creator_id: Optional[int] = None,
                           creator_department_id: Optional[int] = None,
                           extraction_id: Optional[int] = None,
                           onlyExtracted: bool = False):
    query_base = db.query(models.RecordView)

    if sysno is not None:
        query_base = query_base.filter(models.RecordView.sysno == sysno)
    if creator_id is not None:
        query_base = query_base.filter(models.RecordView.creator_id == creator_id)
    if creator_department_id is not None:
        query_base = query_base.filter(models.RecordView.creator_department_id == creator_department_id)
    if extraction_id is not None:
        query_base = query_base.filter(models.RecordView.extraction_id == extraction_id)
    if onlyExtracted:
        query_base = query_base.filter(models.RecordView.extraction_id.isnot(None))

    return query_base


def get_records(db: Session,
                query_base: Session,
                offset: int = 0, 
                limit: int = 100):
    return query_base.order_by(desc(models.RecordView.created_at))\
    .offset(offset).limit(limit).all()


def get_records_num_found(db: Session,
                          query_base: Session):
    return query_base.count()


def create_comment(comment: schemas.CommentCreate,
                   record_id: int,
                   user_id: int,
                   db: Session):
    return create(db, models.Comment(
        record_id=record_id,
        user_id=user_id,
        text=comment.text
    ))


def update_comment(comment: schemas.Comment,
                   db: Session):
    db.execute(update(models.Comment).where(models.Comment.id == comment.id)
            .values(text = comment.text)
            .values(edited_at = func.now()))


def delete_comment(comment_id: int,
                   db: Session):
    db_comment = db.query(models.Comment).where(models.Comment.id == comment_id).first()
    db.delete(db_comment)
    db.commit()
    return db_comment


def get_comment(comment_id: int,
                db: Session):
    return db.query(models.Comment)\
    .filter(models.Comment.id == comment_id)\
    .first()


def get_comments_for_record(record_id: int,
                            db: Session):
    return db.query(models.Comment).filter(models.Comment.record_id == record_id).all()


def create_extraction(extraction: schemas.ExtractionCreate,
                      user_id: int,
                      db: Session):
    if not extraction.extracted_records:
        return

    db_extraction = create(db, models.Extraction(
        extractor_id=user_id
    ))

    for record_id in extraction.extracted_records:
        db.execute(update(models.Record).where(models.Record.id == record_id)
            .values(extraction_id = db_extraction.id))
    
    return db_extraction
