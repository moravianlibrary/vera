from fastapi import FastAPI, Depends, HTTPException, Form, Path, Query, status, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from os import environ
from typing import List, Optional

import actions, auth, catalog, crud, models, schemas
from database import get_db
from etypes import ActionType


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=(environ.get("ALLOW_ORIGINS").split(",")),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO: add support to log editing of records
# TODO: add checking unique before insert and update


@app.on_event("startup")
async def on_startup():
    admin_username = environ.get("ADMIN_USERNAME")
    admin_password = environ.get("ADMIN_PASSWORD")

    if admin_username and admin_password:
        db = next(get_db())
        db_user = crud.get_user_by_username("admin", db)
        if db_user is None:
            db_user = auth.create_user(schemas.UserCreate(
                username=admin_username,
                password=admin_password
            ), db)
            crud.update_user(schemas.User(
                id=db_user.id,
                username=db_user.username,
                department_id=None,
                role_id=1
            ), db)



@app.post("/auth/register", response_model=schemas.User)
def register(
            user_create: schemas.UserCreate,
            db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(user_create.username, db)
    if db_user is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Username is already taken")
    return auth.create_user(user_create, db)


@app.post("/auth/login", response_model=schemas.Token)
async def login(
            user_login: schemas.UserLogin,
            db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(user_login.username, db)
    if db_user is None or not auth.verify_password(user_login.password, db_user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token, expires_on = auth.create_access_token(data={"sub": db_user.username})
    return schemas.Token(
        access_token=access_token,
        token_type="bearer",
        expires_on=expires_on
    )


@app.get("/auth/current_user", response_model=schemas.CurrentUser)
def get_current_user(user: schemas.CurrentUser = Depends(auth.get_current_user)):
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.put("/users/{user_id}/password", response_model=schemas.User)
def update_user_password(
            user_change_password: schemas.UserChangePassword,
            user_id: int = Path(...),
            db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return auth.change_user_password(db, user_change_password)


@app.post("/roles", response_model=schemas.RoleActions)
def create_role(role: schemas.RoleCreate,
                db: Session = Depends(get_db)):
    db_role = crud.create_role(role, db)
    crud.create_role_actions(db_role.id, role.actions, db)
    return schemas.RoleActions(
        id=db_role.id,
        name=db_role.name,
        actions=get_role_actions(db_role.id, db)
    )


@app.put("/roles/{role_id}", response_model=schemas.RoleActions)
def update_role(role: schemas.RoleActions,
                db: Session = Depends(get_db)):
    db_role = crud.update_role(role, db)
    crud.update_role_actions(role, db)
    return schemas.RoleActions(
        id=db_role.id,
        name=db_role.name,
        actions=get_role_actions(db_role.id, db)
    )


@app.delete("/roles/{role_id}", response_model=schemas.Role)
def delete_role(role_id: int,
                db: Session = Depends(get_db)):
    return crud.delete_role(role_id, db)


def get_role_actions(role_id: int, db: Session):
    return [action[0] for action in crud.get_role_actions(role_id, db)]


@app.get("/roles/{role_id}", response_model=schemas.RoleActions)
def get_role(role_id: int = Path(...),
             db: Session = Depends(get_db)):
    db_role = crud.get_role(role_id, db)
    if db_role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return schemas.RoleActions(
        id=db_role.id,
        name=db_role.name,
        actions=get_role_actions(role_id, db)
    )


@app.get("/roles_names", response_model=schemas.RolesResponse)
def get_roles_names(db: Session = Depends(get_db)):
    return schemas.RolesResponse(roles=[schemas.Role(id=role.id, name=role.name) for role in crud.get_roles(db)])


@app.get("/roles", response_model=schemas.RolesActionsResponse)
def get_roles(db: Session = Depends(get_db)):
    return schemas.RolesActionsResponse(roles=[schemas.RoleActions(
        id=role.id,
        name=role.name,
        actions=get_role_actions(role.id, db)
    ) for role in crud.get_roles(db)])


@app.post("/departments", response_model=schemas.Department)
def create_department(department: schemas.DepartmentBase,
                      db: Session = Depends(get_db)):
    return crud.create_department(department, db)


@app.put("/departments/{department_id}", response_model=schemas.Department)
def create_department(department: schemas.Department,
                      db: Session = Depends(get_db)):
    crud.update_department(department, db)
    return department


@app.delete("/departments/{department_id}", response_model=schemas.Department)
def delete_department(department_id: int = Path(...),
                      db: Session = Depends(get_db)):
    return crud.delete_department(department_id, db)


@app.get("/departments", response_model=schemas.DepartmentsResponse)
def create_department(db: Session = Depends(get_db)):
    return schemas.DepartmentsResponse(departments=[schemas.Department(id=department.id, abbreviation=department.abbreviation, name=department.name) for department in crud.get_departments(db)])


@app.put("/users/{user_id}", response_model=schemas.UserEnlistment)
def update_user(user: schemas.User,
                user_id: int = Path(...),
                db: Session = Depends(get_db)):
    db_user = crud.get_user(user_id, db)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.update_user(user, db)


@app.delete("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int = Path(...),
                db: Session = Depends(get_db)):
    db_user = crud.get_user(user_id, db)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.delete_user(user_id, db)


@app.get("/users/{user_id}", response_model=schemas.UserEnlistment)
def get_user(user_id: int = Path(...),
             db: Session = Depends(get_db)):
    db_user = crud.get_user(user_id, db)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@app.get("/users/{user_id}/actions", response_model=schemas.RoleActions)
def get_user(user_id: int = Path(...),
             db: Session = Depends(get_db)):
    db_user = crud.get_user(user_id, db)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_role = crud.get_role(db_user.role_id, db)
    if db_role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return schemas.RoleActions(
        id=db_role.id,
        name=db_role.name,
        actions=get_role_actions(db_user.role_id, db)
    )


@app.get("/users", response_model=schemas.UsersResponse)
def get_users(offset: int = Query(0, description="Offset for pagination"),
              limit: int = Query(100, description="Limit for pagination"),
              db: Session = Depends(get_db)):
    users = crud.get_users(db, offset=offset, limit=limit), 
    return schemas.UsersResponse(
        users=users[0],
        num_found=crud.get_users_num_found(db))


@app.post("/categories", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate,
                    db: Session = Depends(get_db)):
    return crud.create_category(category, db)


@app.put("/categories/{category_id}", response_model=schemas.Category)
def update_category(category: schemas.Category,
                    category_id: int = Path(...),
                    db: Session = Depends(get_db)):
    return crud.update_category(category, db)


@app.delete("/categories/{category_id}", response_model=schemas.Category)
def update_category(category_id: int = Path(...),
                    db: Session = Depends(get_db)):
    return crud.delete_category(category_id, db)


@app.get("/categories", response_model=List[schemas.Category])
def create_category(db: Session = Depends(get_db)):
    return crud.get_categories(db)


@app.post("/records", response_model=schemas.RecordView)
def create_record(record: schemas.RecordCreate,
                  db: Session = Depends(get_db),
                  user: schemas.User = Depends(auth.get_current_user)):
    return crud.create_record(record, user, db)


@app.post("/records/precreate_by_identifier", response_model=schemas.RecordPrecreate)
def precreate_by_identifier(identifier: schemas.Identifier,
                            db: Session = Depends(get_db)):
    return catalog.generate_record_by_identifier(identifier)


@app.post("/records_file/{category_id}")
async def create_records(file: UploadFile,
                         category_id: int,
                         db: Session = Depends(get_db),
                         user: schemas.User = Depends(auth.get_current_user)):
    if file.filename:
        records = []
        for record_precreate in catalog.generate_records_from_file((await file.read()).decode('utf-8')):
            if crud.get_record_by_identifiers(record_precreate.sysno,
                    record_precreate.volume_number,
                    record_precreate.item_number,
                    db) is not None:
                continue
            records.append(crud.create_record(
                schemas.RecordCreate.from_record_precreate(record_precreate, category_id),
                user,
                db))
        return records


@app.put("/records/{record_id}", response_model=schemas.RecordView)
def update_record(record: schemas.RecordCreate,
                  record_id: int = Path(...),
                  db: Session = Depends(get_db),
                  user: schemas.User = Depends(auth.get_current_user)):
    return crud.update_record(record_id, record, user, db)


@app.delete("/records/{record_id}", response_model=schemas.Record)
def get_record_by_id(record_id: int = Path(...),
                     db: Session = Depends(get_db)):
    record = crud.get_record(record_id, db)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return crud.delete_record(record_id, db)


@app.get("/records/{record_id}", response_model=schemas.RecordView)
def get_record_by_id(record_id: int = Path(...),
                     db: Session = Depends(get_db)):
    record = crud.get_record(record_id, db)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@app.get("/records", response_model=schemas.RecordsResponse)
def get_records(offset: int = Query(0, description="Pagination page offset"),
                limit: int = Query(100, description="Pagination page size"),
                sysno: Optional[str] = Query(None, description="Record sysno"),
                extraction_id: Optional[int] = Query(None, description="Record extraction id"),
                onlyExtracted: Optional[str] = Query(None, description="Show only extracted"),
                user: schemas.CurrentUser = Depends(auth.get_current_user),
                db: Session = Depends(get_db)):
    user_id, department_id = None, None
    if ActionType.read_datatable_department in user.actions and user.department_id is not None:
        department_id = user.department_id
    elif ActionType.read_datatable_own in user.actions:
        user_id = user.id
    elif ActionType.read_datatable_all not in user.actions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is forbidden to read any records")

    query_base = crud.get_records_query_base(db,
                                             sysno=sysno,
                                             creator_id=user_id,
                                             creator_department_id=department_id,
                                             extraction_id=extraction_id, 
                                             onlyExtracted=(onlyExtracted is not None))
    records = crud.get_records(db, query_base, offset=offset, limit=limit)
    num_found = crud.get_records_num_found(db, query_base)
    return schemas.RecordsResponse(records=records, num_found=num_found)


@app.post("/records/{record_id}/comments", response_model=schemas.Comment)
def create_comment(comment: schemas.CommentCreate,
                   record_id: int = Path(...),
                   user: schemas.User = Depends(auth.get_current_user),
                   db: Session = Depends(get_db)):
    return crud.create_comment(comment, record_id, user.id, db)


@app.put("/records/{record_id}/comments/{comment_id}", response_model=schemas.Comment)
def update_comment(comment: schemas.Comment,
                   record_id: int = Path(...),
                   user: schemas.User = Depends(auth.get_current_user),
                   db: Session = Depends(get_db)):
    return crud.update_comment(comment, db)


@app.delete("/records/{record_id}/comments/{comment_id}", response_model=schemas.Comment)
def delete_comment(record_id: int = Path(...),
                   comment_id: int = Path(...),
                   user: schemas.User = Depends(auth.get_current_user),
                   db: Session = Depends(get_db)):
    return crud.delete_comment(comment_id, db)


@app.get("/records/{record_id}/comments/{comment_id}", response_model=schemas.Comment)
def get_comment(record_id: int = Path(...),
                comment_id: int = Path(...), 
                db: Session = Depends(get_db)):
    return crud.get_comment(comment_id, db)


@app.get("/records/{record_id}/comments", response_model=List[schemas.Comment])
def get_note(record_id: int = Path(...),
             db: Session = Depends(get_db)
):
    return crud.get_comments_for_record(record_id, db)


@app.post("/records/extract")
def create_extraction(extraction: schemas.ExtractionCreate,
                    user: schemas.User = Depends(auth.get_current_user),
                    db: Session = Depends(get_db)):
    crud.create_extraction(extraction, user.id, db)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
