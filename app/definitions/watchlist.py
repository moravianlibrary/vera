from enum import Enum


class WatchlistTarget(str, Enum):
    Additions = "Additions"
    CatalogRecords = "CatalogRecords"
    Categories = "Categories"
    Documents = "Documents"
    Projects = "Projects"
    Proposals = "Proposals"


class WatchlistEvent(str, Enum):
    Entered = "Entered"
    Changed = "Changed"
    Exited = "Exited"
