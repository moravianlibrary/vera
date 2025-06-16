from datetime import datetime
from os import remove
from tempfile import NamedTemporaryFile
from typing import List

from fastapi import APIRouter, File, Query, UploadFile
from models.base_engine import (
    get_all_models,
    get_model_by_tablename,
    import_from_yaml,
)
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask
from starlette.responses import FileResponse

from .utils.dependencies import DependsOnDatabaseSession
from .utils.permissions import CanManageSystem

router = APIRouter(prefix="/system", tags=["System"])

YAML_MIMETYPE = "application/x-yaml"


@router.get(
    "/database/export",
    dependencies=[CanManageSystem],
)
def export_from_database(
    tablenames: List[str] = Query([], alias="table"),
    session: Session = DependsOnDatabaseSession,
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


@router.post(
    "/database/import",
    dependencies=[CanManageSystem],
)
async def import_to_database(
    file: UploadFile = File(...), session: Session = DependsOnDatabaseSession
):
    try:
        contents = await file.read()
        yaml_content = contents.decode("utf-8")
        import_from_yaml(session, yaml_content)
        # return {"status": "success", "message": "Data imported successfully"}

    except Exception as e:
        session.rollback()
        raise e
