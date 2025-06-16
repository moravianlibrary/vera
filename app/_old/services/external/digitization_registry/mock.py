from typing import List, Optional
from unittest.mock import MagicMock
from .client import DigitizationRegistryClient
from .record import DigitizationRegistryRecord


class MockDigitizationRegistryClient(DigitizationRegistryClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.get_query_records = MagicMock()
        self.get_record_by_id = MagicMock()
        self.get_record_by_barcode = MagicMock()
        self.get_record_by_volume = MagicMock()
        self.get_record = MagicMock()

    def set_query_records_response(
        self, response: List[DigitizationRegistryRecord]
    ):
        self.get_query_records.return_value = iter(response)

    def set_record_by_id_response(
        self, record: Optional[DigitizationRegistryRecord]
    ):
        self.get_record_by_id.return_value = record

    def set_record_by_barcode_response(
        self, record: Optional[DigitizationRegistryRecord]
    ):
        self.get_record_by_barcode.return_value = record

    def set_record_by_volume_response(
        self, record: Optional[DigitizationRegistryRecord]
    ):
        self.get_record_by_volume.return_value = record

    def set_record_response(
        self, record: Optional[DigitizationRegistryRecord]
    ):
        self.get_record.return_value = record
