from pymarc import marcxml, Record
from io import BytesIO
from typing import Dict, List, Optional
from .types import LibraryPrefix


class KnihovnyCzRecord:
    def __init__(self, sysno, data):
        self.sysno: str = sysno
        self.data: Dict = data

    @property
    def per_library_ids(self) -> Optional[List[str]]:
        return self.data.get("dedupIds")

    def find_id(self, prefix: str) -> Optional[str]:
        if not self.per_library_ids:
            return None
        sysnos = [
            id_ for id_ in self.per_library_ids if id_.startswith(prefix)
        ]
        return sysnos[0].removeprefix(prefix) if len(sysnos) == 1 else None

    @property
    def skc_sysno(self) -> Optional[str]:
        return self.find_id(LibraryPrefix.SKC.value)

    @property
    def marc21(self) -> Optional[Record]:
        xml_string = self.data.get("fullRecord")
        return (
            marcxml.parse_xml_to_array(BytesIO(xml_string.encode("utf-8")))[0]
            if xml_string
            else None
        )
