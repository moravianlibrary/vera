from .addition import AdditionRepository
from .catalog_record import CatalogRecordRepository
from .category import CategoryRepository
from .digitization_list import DigiListRepository
from .distribution import DistributionRepository
from .document import DocumentRepository
from .group import GroupRepository
from .intention import IntentionRepository
from .plugin import PluginRepository
from .proposal import ProposalRepository
from .role import RoleRepository
from .user import UserRepository
from .watchlist import WatchlistRepository

__all__ = [
    "CatalogRecordRepository",
    "CategoryRepository",
    "DigiListRepository",
    "DistributionRepository",
    "DocumentRepository",
    "AdditionRepository",
    "GroupRepository",
    "IntentionRepository",
    "PluginRepository",
    "ProposalRepository",
    "RoleRepository",
    "UserRepository",
    "WatchlistRepository",
]
