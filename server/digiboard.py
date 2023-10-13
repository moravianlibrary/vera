from fastapi import FastAPI, Depends, HTTPException, Form, Path, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

import actions, auth, catalog, crud, models, schemas
from database import get_db


app = FastAPI()

CAN_BROWSE_USERS = [Depends(actions.can_edit_users)]
CAN_EDIT_USER = [Depends(actions.can_edit_user)]
IS_USER = [Depends(actions.is_user)]
CAN_BROWSE_RECORDS = [Depends(actions.can_browse_records)]
CAN_CREATE_RECORDS = [Depends(actions.can_create_records)]
CAN_COMMENT_ON_RECORD = [Depends(actions.can_comment_on_record)]
CAN_EDIT_RECORD = [Depends(actions.can_edit_record)]
CAN_EXTRACT_RECORDS = [Depends(actions.can_extract_records)]

origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO: add support to log editing of records


@app.post("/auth/register", response_model=schemas.User)
def register(
            user_create: schemas.UserCreate,
            db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, user_create.username)
    if db_user is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Username is already taken")
    return auth.create_user(db, user_create)


@app.post("/auth/login", response_model=schemas.Token)
async def login(
            user_login: schemas.UserLogin,
            db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, user_login.username)
    if db_user is None or not auth.verify_password(user_login.password, db_user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    return {"access_token": auth.create_access_token(data={"sub": db_user.username}), "token_type": "bearer"}


@app.get("/users", response_model=schemas.UsersResponse, dependencies=CAN_EDIT_USERS)
def get_users(
            offset: int = Query(0, description="Offset for pagination"),
            limit: int = Query(100, description="Limit for pagination"),
            db: Session = Depends(get_db)):
    users = crud.get_users(db, offset=offset, limit=limit), 
    return schemas.UsersResponse(
        users=[schemas.UserRoles(
            id=user.id,
            username=user.username,
            department=user.department,
            roles=(role[0] for role in crud.get_user_roles(db, user.id)))
            for user in users[0]
        ],
        num_found=crud.get_users_num_found(db))


@app.get("/users/{user_id}", response_model=schemas.User, dependencies=CAN_EDIT_USER)
def get_user(
            user_id: int = Path(...),
            db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@app.put("/users/{user_id}", response_model=schemas.User, dependencies=CAN_EDIT_USER)
def update_user(
            user: schemas.User,
            user_id: int = Path(...),
            db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.update_user(db, user)


@app.put("/users/{user_id}/password", response_model=schemas.User, dependencies=IS_USER)
def update_user_password(
            user_change_password: schemas.UserChangePassword,
            user_id: int = Path(...),
            db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return auth.change_user_password(db, user_change_password)


# Define the /records/{id} endpoint to get a record by id
@app.get("/records/{record_id}", response_model=schemas.Record, dependencies=CAN_BROWSE_RECORDS)
def get_record_by_id(record_id: int = Path(...), db: Session = Depends(get_db)):
    record = crud.get_record(db, record_id=record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


# Define the /records endpoint to get a record by sysno
@app.get("/records", response_model=schemas.RecordsResponse, dependencies=CAN_BROWSE_RECORDS)
def get_records(
    sysno: Optional[str] = Query(None, description="Record sysno"),
    page: int = Query(1, description="Pagination page"),
    page_size: int = Query(100, description="Pagination page size"),
    db: Session = Depends(get_db)
):
    records = crud.get_records(db, sysno=sysno, offset=((page - 1) * page_size), limit=page_size)
    num_found = crud.get_records_num_found(db, sysno=sysno)
    return schemas.RecordsResponse(records=records, num_found=num_found)


@app.post("/records", response_model=schemas.Record, dependencies=CAN_CREATE_RECORDS)
def create_record(record: schemas.RecordCreate, db: Session = Depends(get_db), user: schemas.User = Depends(auth.get_current_user)):
    return crud.create_record(db=db, record=record, user=user)


@app.post("/records/precreate_by_identifier", response_model=schemas.RecordPreCreate, dependencies=CAN_CREATE_RECORDS)
def precreate_by_identifier(identifier: schemas.Identifier, db: Session = Depends(get_db)):
    return catalog.generate_record_by_identifier(identifier)


@app.get("/records/{record_id}/notes/{user_id}", response_model=schemas.Note, dependencies=CAN_BROWSE_RECORDS)
def get_note(record_id: int = Path(...), user_id: int = Path(...), db: Session = Depends(get_db)):
    note = crud.get_note(db, record_id=record_id, user_id=user_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@app.get("/records/{record_id}/notes", response_model=schemas.Note, dependencies=CAN_BROWSE_RECORDS)
def get_note(
    record_id: int = Path(...),
    offset: int = Query(0, description="Offset for pagination"),
    limit: int = Query(100, description="Limit for pagination"),
    db: Session = Depends(get_db)
):
    return crud.get_notes_for_record(db, record_id=record_id, offset=offset, limit=limit)


@app.post("/records/{record_id}/notes", response_model=schemas.Note, dependencies=CAN_COMMENT_ON_RECORD)
def create_note(note: schemas.NoteCreate, db: Session = Depends(get_db)):
    db_note = crud.get_note(db, record_id=note.record_id, user_id=note.user_id)
    if db_note:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_note(db=db, note=note)


if __name__ == "__main__":
    import uvicorn

    print(crud.get_users(get_db(), 0, 100))
    uvicorn.run(app, host="127.0.0.1", port=8000)
