from typing import List, Dict
from schemas import DRAdapterResponse, DRAdapterConfig, Record, Issue
from .adapter_interface import DRAdapterInterface
from .kramerius_adapter import DRKrameriusAdapter
from .rdcz_adapter import RDczAdapter


class DRAdapter:
    def __init__(self):
        self.adapters: Dict[str, DRAdapterInterface] = dict()

    def loadConfig(self, config: DRAdapterConfig):
        self.adapters = dict()

        for adapter_config in config["adapters"]:
            source = adapter_config["source"]

            if source == "kramerius":
                code = adapter_config["krameriusConfig"]["code"]
                if code in self.adapters:
                    raise ValueError(f"Duplicate adapter code: {code}")

                self.adapters[code] = DRKrameriusAdapter(
                    adapter_config["krameriusConfig"]
                )

            elif source == "rdcz":
                if source in self.adapters:
                    raise ValueError(f"Duplicate adapter code: {source}")

                self.adapters[source] = RDczAdapter(
                    adapter_config["rdczConfig"]
                )

    def getRecord(self, source: str, record_id: str) -> DRAdapterResponse:
        return self.adapters[source].get_record(record_id)

    def search(self, record: Record, issue: Issue) -> List[DRAdapterResponse]:
        return [
            adapter.search(record, issue) for adapter in self.adapters.values()
        ]
