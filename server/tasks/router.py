from fastapi import APIRouter
from . import processes, schemas

router = APIRouter()

@router.post("/predict/pages", response_model=schemas.Task)
async def predict_pages():
    return await processes.predict_pages()