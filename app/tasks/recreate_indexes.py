from sqlalchemy.orm import Session

from adapters.elasticsearch import with_es_session
from models import CatalogRecord, Document
from schemas import EsSession, IndexCatalogRecord, IndexDocument


@with_es_session
def RecreateIndexes(es_session: EsSession, db_session: Session, task_id: int):
    IndexCatalogRecord.recreate_index(es_session)
    IndexDocument.recreate_index(es_session)

    for document in CatalogRecord.all(db_session):
        IndexCatalogRecord.model_validate(document).save(es_session)

    for document in Document.all(db_session):
        IndexDocument.model_validate(document).save(es_session)
