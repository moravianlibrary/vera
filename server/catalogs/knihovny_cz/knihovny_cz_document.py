from pymarc import marcxml, Record
from io import BytesIO
from typing import Dict, List, Optional


class KnihovnyCzDocument:
    def __init__(self, sysno, data):
        self._sysno: str = sysno
        self.data: Dict = data

    @property
    def sysno(self) -> str:
        return self._sysno

    @property
    def per_library_ids(self) -> Optional[List[str]]:
        return self.data.get("dedupIds")

    @property
    def marc21(self) -> Optional[Record]:
        xml_string = self.data.get("fullRecord")
        return (
            marcxml.parse_xml_to_array(BytesIO(xml_string.encode("utf-8")))[0]
            if xml_string
            else None
        )
