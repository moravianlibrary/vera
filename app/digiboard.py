from fastapi import FastAPI, Depends, HTTPException, Form, Path, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

import auth, crud, models, schemas
from database import get_db


app = FastAPI()

PROTECTED = [Depends(auth.get_current_user)]

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


@app.post("/auth/login", response_model=schemas.Token)
async def login_for_access_token(user_login: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, user_login.username)
    if db_user is None or not auth.verify_password(user_login.password, db_user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    
    access_token = auth.create_access_token(data={"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer"}


# @app.get("/users/{user_id}", response_model=schemas.User)
# def read_user(user_id: int = Path(...), db: Session = Depends(get_db)):
#     db_user = crud.get_user(db, user_id=user_id)
#     if db_user is None:
#         raise HTTPException(status_code=404, detail="User not found")
#     return db_user


# @app.get("/users", response_model=List[schemas.User])
# def read_users(
#     offset: int = Query(0, description="Offset for pagination"),
#     limit: int = Query(100, description="Limit for pagination"),
#     db: Session = Depends(get_db)
# ):
#     return crud.get_users(db, offset=offset, limit=limit)


# @app.post("/users", response_model=schemas.User)
# def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
#     db_user = crud.get_user_by_email(db, email=user.email)
#     if db_user:
#         raise HTTPException(status_code=400, detail="Email already registered")
#     return crud.create_user(db=db, user=user)


# Define the /records/{id} endpoint to get a record by id
@app.get("/records/{record_id}", response_model=schemas.Record, dependencies=PROTECTED)
def get_record_by_id(record_id: int = Path(...), db: Session = Depends(get_db)):
    record = crud.get_record(db, record_id=record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


# Define the /records endpoint to get a record by sysno
@app.get("/records", response_model=schemas.RecordsResponse, dependencies=PROTECTED)
def get_records(
    sysno: Optional[str] = Query(None, description="Record sysno"),
    page: int = Query(1, description="Pagination page"),
    page_size: int = Query(100, description="Pagination page size"),
    db: Session = Depends(get_db)
):
    records = crud.get_records(db, sysno=sysno, offset=((page - 1) * page_size), limit=page_size)
    num_found = crud.get_records_num_found(db, sysno=sysno)
    return schemas.RecordsResponse(records=records, num_found=num_found)


@app.post("/records", response_model=schemas.Record, dependencies=PROTECTED)
def create_user(record: schemas.RecordCreate, db: Session = Depends(get_db), user: schemas.User = Depends(auth.get_current_user)):
    return crud.create_record(db=db, record=record, user=user)


@app.get("/records/{record_id}/notes/{user_id}", response_model=schemas.Note, dependencies=PROTECTED)
def get_note(record_id: int = Path(...), user_id: int = Path(...), db: Session = Depends(get_db)):
    note = crud.get_note(db, record_id=record_id, user_id=user_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@app.get("/records/{record_id}/notes", response_model=schemas.Note, dependencies=PROTECTED)
def get_note(
    record_id: int = Path(...),
    offset: int = Query(0, description="Offset for pagination"),
    limit: int = Query(100, description="Limit for pagination"),
    db: Session = Depends(get_db)
):
    return crud.get_notes_for_record(db, record_id=record_id, offset=offset, limit=limit)


@app.post("/records/{record_id}/notes", response_model=schemas.Note, dependencies=PROTECTED)
def create_note(note: schemas.NoteCreate, db: Session = Depends(get_db)):
    db_note = crud.get_note(db, record_id=note.record_id, user_id=note.user_id)
    if db_note:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_note(db=db, note=note)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
