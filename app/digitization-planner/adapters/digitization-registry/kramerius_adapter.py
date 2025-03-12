from typing import List
from .adapter_interface import DRAdapterInterface
from schemas import DRAdapterResponse, KrameriusConfig, Record, Issue


class DRKrameriusAdapter(DRAdapterInterface):
    def __init__(self, config: KrameriusConfig):
        self.config = config

    def getRecord(self, record_id: str) -> List[DRAdapterResponse]:
        pass

    def search(self, record: Record, issue: Issue) -> List[DRAdapterResponse]:
        pass
