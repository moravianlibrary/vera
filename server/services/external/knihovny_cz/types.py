from enum import Enum


class LibraryPrefix(Enum):
    SKC = "caslin"
    MZK = "mzk"


class KnihovnyCzField(Enum):
    FullRecord = "fullRecord"
    PerLibraryIds = "dedupIds"
    Id = "id"
