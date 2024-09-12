from unittest.mock import MagicMock
from .client import AlephClient
from .record import AlephRecord
from .datatypes import AlephResponseStatus
from typing import List, Optional


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


class MockAlephRecord:
    def __init__(self, sysno: str):
        self._sysno = sysno
        self._cnb = None
        self._language = None
        self._isxn = None
        self._sigla = None
        self._signature = None
        self._title = None
        self._part_number = None
        self._part_title = None
        self._edition = None
        self._material_type_str = None
        self._material_type = None
        self._publishers = []
        self._publishing_places = []
        self._publisher = None
        self._publishing_place = None
        self._publishing_year = None
        self._languages = []
        self._extent = None
        self._additional_physical_data = None
        self._size = None
        self._locationUri = None
        self._frequencies = []

    @property
    def sysno(self) -> str:
        return self._sysno

    @sysno.setter
    def sysno(self, value: str):
        self._sysno = value

    @property
    def cnb(self) -> Optional[str]:
        return self._cnb

    @cnb.setter
    def cnb(self, value: Optional[str]):
        self._cnb = value

    @property
    def language(self) -> Optional[str]:
        return self._language

    @language.setter
    def language(self, value: Optional[str]):
        self._language = value

    @property
    def isxn(self) -> Optional[str]:
        return self._isxn

    @isxn.setter
    def isxn(self, value: Optional[str]):
        self._isxn = value

    @property
    def sigla(self) -> Optional[str]:
        return self._sigla

    @sigla.setter
    def sigla(self, value: Optional[str]):
        self._sigla = value

    @property
    def signature(self) -> Optional[str]:
        return self._signature

    @signature.setter
    def signature(self, value: Optional[str]):
        self._signature = value

    @property
    def title(self) -> Optional[str]:
        return self._title

    @title.setter
    def title(self, value: Optional[str]):
        self._title = value

    @property
    def part_number(self) -> Optional[str]:
        return self._part_number

    @part_number.setter
    def part_number(self, value: Optional[str]):
        self._part_number = value

    @property
    def part_title(self) -> Optional[str]:
        return self._part_title

    @part_title.setter
    def part_title(self, value: Optional[str]):
        self._part_title = value

    @property
    def edition(self) -> Optional[str]:
        return self._edition

    @edition.setter
    def edition(self, value: Optional[str]):
        self._edition = value

    @property
    def material_type_str(self) -> Optional[str]:
        return self._material_type_str

    @material_type_str.setter
    def material_type_str(self, value: Optional[str]):
        self._material_type_str = value

    @property
    def material_type(self) -> Optional[str]:
        return self._material_type

    @material_type.setter
    def material_type(self, value: Optional[str]):
        self._material_type = value

    @property
    def publishers(self) -> List[str]:
        return self._publishers

    @publishers.setter
    def publishers(self, value: List[str]):
        self._publishers = value

    @property
    def publishing_places(self) -> List[str]:
        return self._publishing_places

    @publishing_places.setter
    def publishing_places(self, value: List[str]):
        self._publishing_places = value

    @property
    def publisher(self) -> Optional[str]:
        return self._publisher

    @publisher.setter
    def publisher(self, value: Optional[str]):
        self._publisher = value

    @property
    def publishing_place(self) -> Optional[str]:
        return self._publishing_place

    @publishing_place.setter
    def publishing_place(self, value: Optional[str]):
        self._publishing_place = value

    @property
    def publishing_year(self) -> Optional[str]:
        return self._publishing_year

    @publishing_year.setter
    def publishing_year(self, value: Optional[str]):
        self._publishing_year = value

    @property
    def languages(self) -> List[str]:
        return self._languages

    @languages.setter
    def languages(self, value: List[str]):
        self._languages = value

    @property
    def extent(self) -> Optional[str]:
        return self._extent

    @extent.setter
    def extent(self, value: Optional[str]):
        self._extent = value

    @property
    def additional_physical_data(self) -> Optional[str]:
        return self._additional_physical_data

    @additional_physical_data.setter
    def additional_physical_data(self, value: Optional[str]):
        self._additional_physical_data = value

    @property
    def size(self) -> Optional[str]:
        return self._size

    @size.setter
    def size(self, value: Optional[str]):
        self._size = value

    @property
    def locationUri(self) -> Optional[str]:
        return self._locationUri

    @locationUri.setter
    def locationUri(self, value: Optional[str]):
        self._locationUri = value

    @property
    def frequencies(self) -> List[str]:
        return self._frequencies

    @frequencies.setter
    def frequencies(self, value: List[str]):
        self._frequencies = value
