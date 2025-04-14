from enum import Enum


class GeneralPermission(Enum):
    # Catalog browsing
    SearchCatalog = "SearchCatalog"

    # Documents
    ProposeDocuments = "ProposeDocuments"
    AddDocuments = "AddDocuments"
    ReviewDocumentProposals = "ReviewDocumentProposals"
    DeclineDigitization = "DeclineDigitization"

    # Catalog records
    ReadCatalogRecords = "ReadCatalogRecords"
    ReviewCatalogRecords = "ReviewCatalogRecords"
    ManageCatalogRecordLists = "ManageCatalogRecordLists"

    # Projects
    CreateProjects = "CreateProjects"

    # Intentions
    CreateIntentions = "CreateIntentions"

    # Digitization lists
    GenerateDocumentLists = "GenerateDocumentLists"
    ReadDigitizationLists = "ReadDigitizationLists"
    CreateDigitizationLists = "CreateDigitizationLists"
    ManageDigitizationLists = "ManageDigitizationLists"

    # Tasks
    PlanTasks = "PlanTasks"

    # Access control
    ReadUsersAndGroups = "ReadUsersAndGroups"
    ManageAccess = "ManageAccess"
    EmulateAccess = "EmulateAccess"

    # System-level
    ManageSystemSettings = "ManageSystemSettings"
    ManageSystem = "ManageSystem"
    # TODO: decide
    # ManageArchived = "ManageArchived"
    # DeleteItems = "DeleteItems"
    # DeleteArchivedItems = "DeleteArchivedItems"


class OwnershipPermission(Enum):
    ReadDocuments = "ReadDocuments"
    ManageDocuments = "ManageDocuments"

    CreateCategories = "CreateCategories"
    ReadCategories = "ReadCategories"
    ManageCategories = "ManageCategories"
    ManageCategoryDistribution = "ManageCategoryDistribution"

    ReadProjects = "ReadProjects"
    ManageProjects = "ManageProjects"

    ReadIntentions = "ReadIntentions"
    ManageIntentions = "ManageIntentions"

    ManageTasks = "ManageTasks"


class OwnershipScope(Enum):
    Own = "Own"
    Group = "Group"
    All = "All"
