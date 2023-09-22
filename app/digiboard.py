from fastapi import FastAPI, Depends, HTTPException, Form, Path, Query
from fastapi.middleware.cors import CORSMiddleware
# from models import UserDB
# from fastapi_users.authentication import JWTAuthentication
from sqlalchemy.orm import Session
from typing import List, Optional

import crud, models, schemas
from database import SessionLocal, engine

app = FastAPI()

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

# fastapi_users = FastAPIUsers(
#     user_db=SQLAlchemyUserDatabase(UserDB, database),
#     auth_backends=[JWTAuthentication(secret=your_secret_key, lifetime_seconds=your_token_lifetime)],
# )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int = Path(...), db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@app.get("/users", response_model=List[schemas.User])
def read_users(
    offset: int = Query(0, description="Offset for pagination"),
    limit: int = Query(100, description="Limit for pagination"),
    db: Session = Depends(get_db)
):
    return crud.get_users(db, offset=offset, limit=limit)


@app.post("/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)


# Define the /records/{id} endpoint to get a record by id
@app.get("/records/{record_id}", response_model=schemas.Record)
def get_record_by_id(record_id: int = Path(...), db: Session = Depends(get_db)):
    record = crud.get_record(db, record_id=record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


# Define the /records endpoint to get a record by sysno
@app.get("/records", response_model=List[schemas.Record])
def get_records(
    sysno: Optional[str] = Query(None, description="Record sysno"),
    offset: int = Query(0, description="Offset for pagination"),
    limit: int = Query(100, description="Limit for pagination"),
    db: Session = Depends(get_db)
):
    return crud.get_records(db, sysno=sysno, offset=offset, limit=limit)


@app.post("/records", response_model=schemas.Record)
def create_user(record: schemas.RecordCreate, db: Session = Depends(get_db)):
    if not record.creator:
        raise HTTPException(status_code=401, detail="User not authenticated")
    return crud.create_record(db=db, record=record)


@app.get("/records/{record_id}/notes/{user_id}", response_model=schemas.Note)
def get_note(record_id: int = Path(...), user_id: int = Path(...), db: Session = Depends(get_db)):
    note = crud.get_note(db, record_id=record_id, user_id=user_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@app.get("/records/{record_id}/notes", response_model=schemas.Note)
def get_note(
    record_id: int = Path(...),
    offset: int = Query(0, description="Offset for pagination"),
    limit: int = Query(100, description="Limit for pagination"),
    db: Session = Depends(get_db)
):
    return crud.get_notes_for_record(db, record_id=record_id, offset=offset, limit=limit)


@app.post("/records/{record_id}/notes", response_model=schemas.Note)
def create_note(note: schemas.NoteCreate, db: Session = Depends(get_db)):
    db_note = crud.get_note(db, record_id=note.record_id, user_id=note.user_id)
    if db_note:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_note(db=db, note=note)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
