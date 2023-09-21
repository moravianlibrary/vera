from fastapi import FastAPI, Depends, HTTPException, Form, Path, Query
# from models import UserDB
# from fastapi_users.authentication import JWTAuthentication
from sqlalchemy.orm import Session

import models, schemas
# import crud, models, schemas
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


@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)


@app.get("/users/", response_model=list[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = crud.get_users(db, skip=skip, limit=limit)
    return users


@app.get("/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@app.post("/records/")
async def create_record(
    sysno: str = Form(...),
    volume_number: str = Form(...),
    item_number: str = Form(...),
    creator: str = Form(...),
    # creator: UserDB = Depends(CurrentUser(active=True)),
    db: Session = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")

    # Create a new record record in the database
    new_record = Record(
        sysno=sysno, 
        volume_number=volume_number, 
        item_number=item_number, 
        creator=creator
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record


# Define the /records/{id} endpoint to get a record by id
@app.get("/records/{id}", response_model=schemas.Record)
def get_record_by_id(id: int = Path(...), db: Session = Depends(get_db)):
    record = db.query(models.Record).filter(models.Record.id == id).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


# Define the /records endpoint to get a records by url query
@app.get("/records", response_model=schemas.Record)
def get_record_by_sysno(sysno: str = Query(..., description="Record sysno to retrieve"), db: Session = Depends(get_db)):
    record = db.query(models.Record).filter(models.Record.sysno == sysno).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
