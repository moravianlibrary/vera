from fastapi import APIRouter
from . import schemas


router = APIRouter()


@router.post("/tasks/predict", response_model=schemas.Task)
def predict_pages():
    pass
