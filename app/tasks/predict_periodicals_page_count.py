from mzk_aleph import MaterialType
from sqlalchemy.orm import Session

from adapters.elasticsearch import with_es_session
from models import Document, TaskItem
from schemas import AlephMzkIssue, AlephMzkRecord, EsSession, IndexDocument
from services.predictor import Predictor
from tasks.run_items_processing import run_items_processing_task


@with_es_session
def PredictPeriodicalsPageCount(
    es_session: EsSession, session: Session, task_id: int
):
    predictor = Predictor.get_instance()

    def predict_volume_pages(task_item: TaskItem) -> None:
        document: Document = task_item.document

        aleph_record = AlephMzkRecord(
            document.catalog_record.main_record, sysno=document.sysno
        )

        if aleph_record.material_type != MaterialType.ContinuingResource:
            raise ValueError(
                f"Invalid material type: {aleph_record.material_type.value}. "
                f"Expected document with material type ContinuingResource."
            )

        aleph_issue = AlephMzkIssue.specific_issue_from_record(
            aleph_record.record, document.barcode, document.volume
        )

        document.pages_count_predicted = (
            predictor.predict_periodicals_page_count(aleph_record, aleph_issue)
        )
        document.save(session)

        IndexDocument.model_validate(document).save(es_session)

    run_items_processing_task(session, task_id, predict_volume_pages)
