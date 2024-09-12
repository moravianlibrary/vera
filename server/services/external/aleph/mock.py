from unittest.mock import MagicMock
from .client import AlephClient
from .record import AlephRecord
from .types import AlephResponseStatus
from typing import Optional


class MockAlephClient(AlephClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.check_catalog_availability = MagicMock()
        self.check_find_endpoint_availability = MagicMock()
        self.get_record = MagicMock()
        self.parse_sysno_request = MagicMock()
        self.search_in_all_bases = MagicMock()
        self.find_sysno = MagicMock()
        self.find_record = MagicMock()

    def set_check_catalog_availability_response(self, success: bool):
        self.check_catalog_availability.return_value = success

    def set_check_find_endpoint_availability_response(self, success: bool):
        self.check_find_endpoint_availability.return_value = success

    def set_get_record_response(
        self, record: Optional[AlephRecord], status: AlephResponseStatus
    ):
        self.get_record.return_value = (record, status)

    def set_parse_sysno_request_response(
        self, value: Optional[str], status: AlephResponseStatus
    ):
        self.parse_sysno_request.return_value = (value, status)

    def set_search_in_all_bases_response(
        self, value: Optional[str], status: AlephResponseStatus
    ):
        self.search_in_all_bases.return_value = (value, status)

    def set_find_sysno_response(
        self, value: Optional[str], status: AlephResponseStatus
    ):
        self.find_sysno.return_value = (value, status)

    def set_find_record_response(
        self, record: Optional[AlephRecord], status: AlephResponseStatus
    ):
        self.find_record.return_value = (record, status)
