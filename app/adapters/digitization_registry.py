from typing import List

from marcdantic import MarcIssue, MarcRecord
from vera_plugins.specs.digitization_registry_adapter import (
    DigitizationRecord,
    DigitizationRecordState,
    DigitizationRegistryAdapterPlugin,
)
from vera_plugins.tools.registry import PluginRegistry


class DigitizationRegistryAdapter(DigitizationRegistryAdapterPlugin):
    def __init__(self, plugin_registry: PluginRegistry):
        instance = plugin_registry.digitization_registry_adapter
        self._plugin = instance.plugin
        self._config = instance.config

    def fetch(self, registry_issue_id: str) -> DigitizationRecord:
        return self._plugin.fetch(registry_issue_id)

    def find_for_marc_record(
        self, record: MarcRecord
    ) -> List[DigitizationRecord] | None:
        return self._plugin.find_for_marc_record(record)

    def find_for_marc_issue(
        self, record: MarcRecord, issue: MarcIssue
    ) -> List[DigitizationRecord] | None:
        return self._plugin.find_for_marc_issue(record, issue)

    def register_digitization(
        self,
        record: MarcRecord,
        issue: MarcIssue | None,
        state: DigitizationRecordState,
    ) -> DigitizationRecord:
        if not self._config.change_state:
            raise NotImplementedError(
                "Used digitization registry adapter "
                "does not support changing digitization states."
            )
        return self._plugin.register_digitization(record, issue, state)

    def change_state(
        self,
        record_id: str,
        issue_id: str,
        state: DigitizationRecordState,
    ) -> None:
        if not self._config.change_state:
            raise NotImplementedError(
                "Used digitization registry adapter "
                "does not support changing digitization states."
            )
        return self._plugin.change_state(record_id, issue_id, state)
