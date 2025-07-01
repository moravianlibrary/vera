from typing import List

from marcdantic import MarcIssue, MarcRecord
from vera_plugins.schemas import DigitizationRegistryPluginInstance
from vera_plugins.specs.digitization_registry_adapter import (
    DigitizationRecord,
    DigitizationRecordState,
    DigitizationRegistryAdapterPlugin,
)
from vera_plugins.tools.registry import PluginRegistry


class DigitizationRegistryAdapter(DigitizationRegistryAdapterPlugin):
    def __init__(
        self,
        plugin_registry: PluginRegistry,
        instance: DigitizationRegistryPluginInstance,
    ):
        self._plugin_registry = plugin_registry
        self.instance = instance

    def fetch(self, registry_issue_id: str) -> DigitizationRecord:
        pass

    def find_for_marc_record(
        self, record: MarcRecord
    ) -> List[DigitizationRecord] | None:
        pass

    def find_for_marc_issue(
        self, record: MarcRecord, issue: MarcIssue
    ) -> List[DigitizationRecord] | None:
        pass

    def register_digitization(
        self,
        record: MarcRecord,
        issue: MarcIssue | None,
        state: DigitizationRecordState,
    ) -> DigitizationRecord:
        raise NotImplementedError(
            "register_digitization not implemented in this plugin"
        )

    def change_state(
        self,
        record_id: str,
        issue_id: str,
        state: DigitizationRecordState,
    ) -> None:
        raise NotImplementedError(
            "change_state not implemented in this plugin"
        )
