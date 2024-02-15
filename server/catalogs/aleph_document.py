from urllib.parse import quote

from pymarc import Field
from catalogs.enums import IssuanceType
from typing import Dict, List, Optional


def encode(text: Optional[str]) -> Optional[str]:
    return quote(text.encode("utf-8")) if text is not None else None


class AlephIssue:
    def __init__(self, field: Field):
        self.field = field

    def get_code_value(self, code) -> Optional[str]:
        values = self.field.get_subfields(code)
        return values[0] if values else None

    @property
    def type(self) -> str:
        if self.field.get_subfields("i"):
            return IssuanceType.Bundle
        if self.field.get_subfields("y"):
            return IssuanceType.Volume
        return IssuanceType.Unit

    @property
    def barcode(self) -> str:
        return self.field.get_subfields("b")[0]

    @property
    def signature(self) -> str:
        return self.field.get_subfields("c")[0]

    @property
    def year(self) -> Optional[str]:
        return self.get_code_value("y")

    @property
    def volume(self) -> Optional[str]:
        return (
            self.get_code_value("d")
            if self.type == IssuanceType.Unit
            else self.get_code_value("v")
        )

    @property
    def bundle(self) -> Optional[str]:
        return self.get_code_value("i")

    def __str__(self):
        properties = [
            f"type: {self.type}",
            f"barcode: {self.barcode}",
            f"signature: {self.signature}",
            f"year: {self.year}",
            f"volume: {self.volume}",
            f"bundle: {self.bundle}",
        ]
        return "\n".join(properties)


class AlephDocument:
    def __init__(self, sysno, marc):
        from pymarc import marcxml, Record
        from io import BytesIO
        from lxml import etree

        marc_xml_bytes = etree.tostring(marc)
        marc_xml_file_like = BytesIO(marc_xml_bytes)
        record: Record = marcxml.parse_xml_to_array(marc_xml_file_like)[0]
        self.record = record
        self._sysno = sysno

    def get_values(self, tag, code, ind1=None, ind2=None):
        return [
            subfield
            for field in self.record.get_fields(tag)
            for subfield in field.get_subfields(code)
            if ind1 is None or field.indicator1 == ind1
            if ind2 is None or field.indicator2 == ind2
        ]

    def get_value(self, tag, code):
        values = self.get_values(tag, code)
        return values[0] if values else None

    @property
    def sysno(self) -> str:
        return self._sysno

    @property
    def cnb(self) -> Optional[str]:
        return self.get_value("015", "a")

    @property
    def isbn_issn(self) -> Optional[str]:
        return self.record.isbn if self.record.isbn else self.record.issn

    @property
    def sigla(self) -> Optional[str]:
        return self.get_value("910", "a")

    @property
    def signature(self) -> Optional[str]:
        signature = self.get_value("910", "b")
        return signature if signature else self.get_value("910", "c")

    @property
    def title(self) -> Optional[str]:
        return self.record.title

    @property
    def part_number(self) -> Optional[str]:
        return self.get_value("245", "n")

    @property
    def part_title(self) -> Optional[str]:
        return self.get_value("245", "p")

    @property
    def edition(self) -> Optional[str]:
        return self.get_value("250", "a")

    @property
    def material_type(self) -> Optional[str]:
        return self.get_value("990", "a")

    @property
    def publishers(self) -> List[str]:
        values = self.get_values("260", "b")
        values.extend(self.get_values("264", "b", ind2="1"))
        return values

    @property
    def publishing_places(self) -> List[str]:
        values = self.get_values("260", "a")
        values.extend(self.get_values("264", "a", ind2="1"))
        return values

    @property
    def publisher(self) -> Optional[str]:
        return self.record.publisher

    @property
    def publishing_place(self) -> Optional[str]:
        publishing_places = self.get_values("260", "a")
        publishing_places.extend(self.get_values("264", "a", ind2="1"))
        return publishing_places[0] if publishing_places else None

    @property
    def publishing_year(self) -> Optional[str]:
        return self.record.pubyear

    @property
    def languages(self) -> List[str]:
        return self.get_values("041", "a")

    @property
    def extent(self) -> Optional[str]:
        return self.get_value("300", "a")

    @property
    def additional_physical_data(self) -> Optional[str]:
        return self.get_value("300", "b")

    @property
    def size(self) -> Optional[str]:
        return self.get_value("300", "c")

    @property
    def frequencies(self) -> List[Dict[str, str]]:
        """Returns a list of dictionaries containing
        frequency and date information.

        Returns: List[Dict[str, str]]: List of dictionaries with keys
        "frequency" and "date"
        """
        return [
            {
                "frequency": freq_subfield,
                "date": date_subfield,
            }
            for field in self.record.get_fields("310", "321")
            for freq_subfield, date_subfield in zip(
                field.get_subfields("a"), field.get_subfields("b")
            )
            if len(field.get_subfields("a")) == len(field.get_subfields("b"))
        ]

    @property
    def issues(self) -> List[AlephIssue]:
        return [AlephIssue(field) for field in self.record.get_fields("996")]

    def __str__(self) -> str:
        issues_str = "\n\n".join(str(issue) for issue in self.issues)
        properties = [
            f"sysno: {self.sysno}",
            f"cnb: {self.cnb}",
            f"isbn_issn: {self.isbn_issn}",
            f"sigla: {self.sigla}",
            f"signature: {self.signature}",
            f"title: {self.title}",
            f"part_number: {self.part_number}",
            f"part_title: {self.part_title}",
            f"edition: {self.edition}",
            f"material_type: {self.material_type}",
            f"publishers: {self.publishers}",
            f"publishing_places: {self.publishing_places}",
            f"publisher: {self.publisher}",
            f"publishing_place: {self.publishing_place}",
            f"publishing_year: {self.publishing_year}",
            f"languages: {self.languages}",
            f"extent: {self.extent}",
            f"additional_physical_data: {self.additional_physical_data}",
            f"size: {self.size}",
            f"frequencies: {self.frequencies}",
            f"issues:\n\n{issues_str}",
        ]
        return "\n".join(properties)
