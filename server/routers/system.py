from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from .utils.dependencies import DependsOnDbSession
from .utils.permissions import CanManageSystem
from models.base_engine import get_all_models, get_model_by_tablename
from typing import List
from tempfile import NamedTemporaryFile
from datetime import datetime
from starlette.background import BackgroundTask
from starlette.responses import FileResponse
from os import remove


router = APIRouter(prefix="/system")

YAML_MIMETYPE = "application/x-yaml"


@router.get(
    "/database/export",
    dependencies=[CanManageSystem],
)
def export_from_database(
    tablenames: List[str] = Query([], alias="table"),
    session: Session = DependsOnDbSession,
):
    try:
        temp_file = NamedTemporaryFile(suffix=".yaml", mode="w", delete=False)
        for model in (
            [get_model_by_tablename(tablename) for tablename in tablenames]
            if tablenames
            else get_all_models()
        ):
            temp_file.write(model.export_to_yaml(session))
        temp_file.flush()

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"vera-export_{timestamp}.yaml"

        return FileResponse(
            temp_file.name,
            media_type=YAML_MIMETYPE,
            filename=filename,
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            },
            background=BackgroundTask(remove, temp_file.name),
        )
    except Exception as e:
        temp_file.close()
        remove(temp_file.name)
        raise e


@router.put(
    "/database/export",
    dependencies=[CanManageSystem],
)
def import_to_database(data: str, session: Session = DependsOnDbSession):
    pass
