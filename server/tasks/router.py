from fastapi import APIRouter
from tasks import schemas


router = APIRouter()


@router.post("/tasks", response_model=schemas.Task)
def predict_pages():
    pass
