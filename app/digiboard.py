from fastapi import FastAPI, Depends, HTTPException, Form, Path, Query
# from models import UserDB
# from fastapi_users.authentication import JWTAuthentication
from sqlalchemy.orm import Session

import crud, models, schemas
from database import SessionLocal, engine

app = FastAPI()

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
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@app.get("/users/", response_model=list[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = crud.get_users(db, skip=skip, limit=limit)
    return users


@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)


# Define the /records/{id} endpoint to get a record by id
@app.get("/records/{id}", response_model=schemas.Record)
def get_record_by_id(id: int = Path(...), db: Session = Depends(get_db)):
    record = crud.get_record(db, record_id=id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


# Define the /records endpoint to get a record by sysno
@app.get("/records", response_model=schemas.Record)
def get_record_by_sysno(sysno: str = Query(..., description="Record sysno to retrieve"), db: Session = Depends(get_db)):
    record = crud.get_record_by_sysno(db, sysno=sysno)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@app.get("/records/", response_model=list[schemas.Record])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    records = crud.get_records(db, skip=skip, limit=limit)
    return records


@app.post("/records/")
def create_user(record: schemas.RecordCreate, db: Session = Depends(get_db)):
    if not record.creator:
        raise HTTPException(status_code=401, detail="User not authenticated")
    return crud.create_record(db=db, record=record)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
