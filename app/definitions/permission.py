from enum import Enum
from typing import Union


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

    CreateWatchlists = "CreateWatchlists"
    ManageWatchlists = "ManageWatchlists"


class OwnershipPermission(Enum):
    # Additions
    ReadAdditions = "ReadAdditions"
    ManageAdditions = "ManageAdditions"

    # Proposals
    ReadProposals = "ReadProposals"
    ManageProposals = "ManageProposals"

    # Documents
    ReadDocuments = "ReadDocuments"
    ManageDocuments = "ManageDocuments"

    # Categories
    ReadCategories = "ReadCategories"
    ManageCategories = "ManageCategories"

    # Projects
    ReadProjects = "ReadProjects"
    ManageProjects = "ManageProjects"

    # Tasks
    ReadTasks = "ReadTasks"
    ManageTasks = "ManageTasks"

    # Watchlists
    ReadWatchlists = "ReadWatchlists"
    ManageWatchlists = "ManageWatchlists"


class OwnershipScope(Enum):
    User = "User"
    Group = "Group"
    Global = "Global"


PermissionType = Union[GeneralPermission, OwnershipPermission]
