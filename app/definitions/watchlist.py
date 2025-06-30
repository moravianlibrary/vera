from enum import Enum

from definitions.permission import GeneralPermission, OwnershipPermission


class WatchlistTarget(str, Enum):
    Additions = "Additions"
    CatalogRecords = "CatalogRecords"
    Categories = "Categories"
    Documents = "Documents"
    Projects = "Projects"
    Proposals = "Proposals"


class WatchlistMode(str, Enum):
    Addition = "Addition"


TARGET_PERMISSIONS = {
    WatchlistTarget.Additions: OwnershipPermission.ReadAdditions,
    WatchlistTarget.CatalogRecords: GeneralPermission.ReadCatalogRecords,
    WatchlistTarget.Categories: OwnershipPermission.ReadCategories,
    WatchlistTarget.Documents: OwnershipPermission.ReadDocuments,
    WatchlistTarget.Projects: OwnershipPermission.ReadProjects,
    WatchlistTarget.Proposals: OwnershipPermission.ReadProposals,
}
