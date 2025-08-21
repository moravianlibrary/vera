from enum import Enum


class TaskState(str, Enum):
    Initializing = "Initializing"
    Planned = "Planned"
    Canceled = "Canceled"
    Running = "Running"
    Skipped = "Skipped"
    Finished = "Finished"
    Failed = "Failed"
    Killed = "Killed"


TASK_STATE_PREDECESSORS = {
    TaskState.Initializing: [],
    TaskState.Planned: [TaskState.Initializing],
    TaskState.Canceled: [TaskState.Planned, TaskState.Initializing],
    TaskState.Running: [TaskState.Planned],
    TaskState.Skipped: [TaskState.Planned],
    TaskState.Finished: [TaskState.Running],
    TaskState.Failed: [
        TaskState.Running,
        TaskState.Planned,
        TaskState.Initializing,
    ],
    TaskState.Killed: [TaskState.Running],
}


class AdditionTask(str, Enum):
    Ingest = "Ingest"
    Reingest = "Reingest"
    Archive = "Archive"
    Delete = "Delete"


class CatalogRecordTask(str, Enum):
    Reindex = "Reindex"
    Sync = "Sync"
    SetForcedValidity = "SetForcedValidity"
    MarkInReview = "MarkInReview"
    ArchiveInactive = "ArchiveInactive"
    Delete = "Delete"


class CategoryTask(str, Enum):
    Reindex = "Reindex"
    DocumentDiscovery = "DocumentDiscovery"


class DigitizationListTask(str, Enum):
    Create = "Create"
    ChangeState = "ChangeState"
    AddDocuments = "AddDocuments"
    RemoveDocuments = "RemoveDocuments"
    Delete = "Delete"


class DocumentTask(str, Enum):
    GenerateList = "GenerateList"
    SetCategory = "SetCategory"
    SetPriority = "SetPriority"
    SetDigitizationDecision = "SetDigitizationDecision"
    Reindex = "Reindex"
    Sync = "Sync"
    Delete = "Delete"


class ProposalTask(str, Enum):
    Ingest = "Ingest"
    Reingest = "Reingest"
    Approve = "Approve"
    Reject = "Reject"
    Archive = "Archive"
    Delete = "Delete"


class SystemTask(str, Enum):
    RecreateIndex = "RecreateIndex"
    ResolveInconsistencies = "ResolveInconsistencies"


class TaskScope(str, Enum):
    Addition = "Addition"
    CatalogRecord = "CatalogRecord"
    Category = "Category"
    DigitizationList = "DigitizationList"
    Document = "Document"
    Proposal = "Proposal"
    System = "System"


TaskType = (
    AdditionTask
    | CatalogRecordTask
    | CategoryTask
    | DigitizationListTask
    | DocumentTask
    | SystemTask
)


SCOPE_TO_TYPE = {
    TaskScope.Addition: AdditionTask,
    TaskScope.CatalogRecord: CatalogRecordTask,
    TaskScope.Category: CategoryTask,
    TaskScope.DigitizationList: DigitizationListTask,
    TaskScope.Document: DocumentTask,
    TaskScope.Proposal: ProposalTask,
    TaskScope.System: SystemTask,
}


class ScopedTaskType(str, Enum):
    # Addition
    Addition_Ingest = "Addition.Ingest"
    Addition_Reingest = "Addition.Reingest"
    Addition_Archive = "Addition.Archive"
    Addition_Delete = "Addition.Delete"

    # CatalogRecord
    CatalogRecord_Reindex = "CatalogRecord.Reindex"
    CatalogRecord_Sync = "CatalogRecord.Sync"
    CatalogRecord_SetForcedValidity = "CatalogRecord.SetForcedValidity"
    CatalogRecord_MarkInReview = "CatalogRecord.MarkInReview"
    CatalogRecord_ArchiveInactive = "CatalogRecord.ArchiveInactive"
    CatalogRecord_Delete = "CatalogRecord.Delete"

    # Category
    Category_Reindex = "Category.Reindex"
    Category_DocumentDiscovery = "Category.DocumentDiscovery"

    # DigitizationList
    DigitizationList_Create = "DigitizationList.Create"
    DigitizationList_ChangeState = "DigitizationList.ChangeState"
    DigitizationList_AddDocuments = "DigitizationList.AddDocuments"
    DigitizationList_RemoveDocuments = "DigitizationList.RemoveDocuments"
    DigitizationList_Delete = "DigitizationList.Delete"

    # Document
    Document_GenerateList = "Document.GenerateList"
    Document_SetCategory = "Document.SetCategory"
    Document_SetPriority = "Document.SetPriority"
    Document_SetDigitizationDecision = "Document.SetDigitizationDecision"
    Document_Reindex = "Document.Reindex"
    Document_Sync = "Document.Sync"
    Document_Delete = "Document.Delete"

    # Proposal
    Proposal_Ingest = "Proposal.Ingest"
    Proposal_Reingest = "Proposal.Reingest"
    Proposal_Approve = "Proposal.Approve"
    Proposal_Reject = "Proposal.Reject"
    Proposal_Archive = "Proposal.Archive"
    Proposal_Delete = "Proposal.Delete"

    # System
    System_RecreateIndex = "System.RecreateIndex"
    System_ResolveInconsistencies = "System.ResolveInconsistencies"
