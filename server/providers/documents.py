from sqlalchemy.orm import Session
from security.types import ActionType
from services import exceptions
from security.schemas import CurrentUser
from typing import Optional
from starlette.responses import FileResponse
import pandas as pd
import tempfile
from datetime import datetime
import crud.documents as crud
import schemas.documents as schemas
import schemas.documents_query as query_schemas


XLSX_MIMETYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)


def filter_documents_query_by_user_permissions(
    user: CurrentUser,
    query: Optional[query_schemas.DocumentsQuery] = None,
):
    if ActionType.ReadDatatableAll in user.actions:
        return query

    if (
        ActionType.ReadCategoriesDepartment in user.actions
        and user.department_id is not None
    ):
        if query is None:
            return query_schemas.DocumentsQuery(
                department_id=user.department_id
            )
        query.department_id = user.department_id
    elif (
        ActionType.ReadDatatableOwn in user.actions
        or ActionType.ReadDatatableDepartment in user.actions
    ):
        if query is None:
            return query_schemas.DocumentsQuery(username=user.username)
        query.username = user.username
    else:
        raise exceptions.UserNotAllowedToReadDocumentsException
    return query


def query_documents(
    user: CurrentUser,
    session: Session,
    query: Optional[query_schemas.DocumentsQuery] = None,
    offset: int = 0,
    limit: int = 100,
):
    query_base = crud.get_documents_query_base(
        session, filter_documents_query_by_user_permissions(user, query)
    )
    return schemas.DocumentsResponse(
        documents=crud.get_documents(query_base, offset=offset, limit=limit),
        num_found=crud.get_documents_num_found(query_base),
    )


def export_query_documents(
    user: CurrentUser,
    session: Session,
    query: Optional[query_schemas.DocumentsQuery] = None,
):
    query_base = crud.get_documents_query_base(
        session, filter_documents_query_by_user_permissions(user, query)
    )
    num_found = crud.get_documents_num_found(query_base)

    documents = crud.get_documents(query_base, limit=num_found)

    df = pd.DataFrame(
        [
            schemas.Document.model_validate(doc).model_dump()
            for doc in documents
        ]
    )

    with tempfile.NamedTemporaryFile(
        suffix=".xlsx", delete=False
    ) as temp_excel:
        df.to_excel(temp_excel.name, index=False)
        temp_filename = temp_excel.name

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    export_filename = f"vera-documents_{timestamp}.xlsx"

    return FileResponse(
        temp_filename,
        media_type=XLSX_MIMETYPE,
        filename=export_filename,
        headers={"Content-Disposition": "attachment"},
    )
