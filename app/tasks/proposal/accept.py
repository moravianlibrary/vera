from adapters.database import DatabaseSession
from adapters.indexer import IndexerSession
from definitions.eligibility import EligibilityStatus
from definitions.proposal import ProposalStatus
from repositories.models.task import TaskAdditionModel, TaskModel
from repositories.proposal import ProposalRepository
from schemas.addition import IngestProposalsAdditionsTaskData
from tasks.addition.ingest_base import IngestAdditionsTaskBase


class AcceptProposalsTask(IngestAdditionsTaskBase):
    def __init__(
        self,
        database_session: DatabaseSession,
        indexer_session: IndexerSession,
    ):
        super().__init__(database_session, indexer_session)
        self._proposal_repository = ProposalRepository(
            database_session, indexer_session
        )

    def init_task(self, task: TaskModel) -> None:
        data = IngestProposalsAdditionsTaskData(task.data)

        for proposal in self._proposal_repository.get_by_query(task.query):
            if (
                proposal.status != ProposalStatus.Pending
                and proposal.status != ProposalStatus.Declined
            ):
                continue
            if (
                proposal.eligibility_status
                == EligibilityStatus.FullyProcessedDuplicate
                and not data.allow_new_iteration
            ):
                continue
            if (
                proposal.eligibility_status == EligibilityStatus.InDigitization
                and not data.ignore_digitization_check
            ):
                continue
            if proposal.eligibility_status != EligibilityStatus.Eligible:
                continue

            task.additions.append(
                TaskAdditionModel(
                    task=task,
                    addition=self._addition_repository.create_from_proposal(
                        proposal,
                        data.batch_id,
                        data.category_id,
                        (
                            proposal.project.priority
                            if proposal.project
                            else data.priority
                        ),
                        task.created_by,
                        data.allow_new_iteration,
                        data.ignore_digitization_check,
                    ),
                )
            )

        super().init_task(task)
