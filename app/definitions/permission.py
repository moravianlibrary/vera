from enum import Enum


class GeneralPermission(Enum):
    # Catalog browsing
    SearchCatalog = "SearchCatalog"

    # Proposals
    ProposeDocuments = "ProposeDocuments"
    ReviewProposals = "ReviewProposals"
    DeleteProposals = "DeleteProposals"

    # Additions
    AddDocuments = "AddDocuments"
    IgnoreAdditionChecks = "IgnoreAdditionChecks"
    DeleteAdditions = "DeleteAdditions"

    # Documents
    DeclineDigitization = "DeclineDigitization"

    # Catalog records
    ReadCatalogRecords = "ReadCatalogRecords"
    ManageCatalogRecords = "ManageCatalogRecords"
    ReviewCatalogRecords = "ReviewCatalogRecords"
    ManageCatalogRecordLists = "ManageCatalogRecordLists"

    # Categories
    ManageDistributions = "ManageDistributions"
    ReadDocumentDiscoveryPlugins = "ReadDocumentDiscoveryPlugins"

    # Projects
    CreateProjects = "CreateProjects"
    ReviewProjects = "ReviewProjects"

    # Intentions
    ReadIntentions = "ReadIntentions"
    ManageIntentions = "ManageIntentions"

    # Digitization lists
    GenerateDocumentLists = "GenerateDocumentLists"
    ReadDigitizationLists = "ReadDigitizationLists"
    CreateDigitizationLists = "CreateDigitizationLists"
    ManageDigitizationLists = "ManageDigitizationLists"

    # Notifications
    ReadWatchlists = "ReadWatchlists"
    ManageWatchlists = "ManageWatchlists"

    # Tasks
    RunTasks = "RunTasks"
    ScheduleTasks = "ScheduleTasks"

    # Access control
    ReadUsersAndGroups = "ReadUsersAndGroups"
    ManageAccess = "ManageAccess"
    EmulateAccess = "EmulateAccess"

    # System-level
    ManageSystem = "ManageSystem"
    UseSystemTasks = "UseSystemTasks"


class OwnershipPermission(Enum):
    ReadAdditions = "ReadAdditions"
    ManageAdditions = "ManageAdditions"

    ReadProposals = "ReadProposals"
    ManageProposals = "ManageProposals"

    ReadDocuments = "ReadDocuments"
    ManageDocuments = "ManageDocuments"

    ReadCategories = "ReadCategories"
    ManageCategories = "ManageCategories"

    ReadProjects = "ReadProjects"
    ManageProjects = "ManageProjects"

    ReadTasks = "ReadTasks"
    ManageTasks = "ManageTasks"


class OwnershipScope(Enum):
    Own = "Own"
    Group = "Group"
    All = "All"
