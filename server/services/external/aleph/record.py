from typing import Dict, List, Optional
from urllib.parse import quote
from pymarc import Record
from .types import MaterialType
from .parsers import parse_page_count, parse_material_type


DEFAULT_DOCUMENT_LANGUAGE = "cze"


def encode(text: Optional[str]) -> Optional[str]:
    return quote(text.encode("utf-8")) if text is not None else None


class Frequency:
    def __init__(self, frequency: str, date: Optional[str] = None):
        self.frequency = frequency
        self.date = date

    def __eq__(self, other):
        return self.frequency == other.frequency and self.date == other.date

    def __repr__(self):
        return (
            f'Frequency(frequency="{self.frequency}", date="{self.date})"'
            if self.date
            else f'Frequency(frequency="{self.frequency}")'
        )


class AlephRecord:
    def __init__(self, sysno: str, record: Record):
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
    def isxn(self) -> Optional[str]:
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
    def material_type_str(self) -> Optional[str]:
        return self.get_value("990", "a")

    @property
    def material_type(self) -> MaterialType:
        return parse_material_type(self.material_type_str)

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
        publisher = self.record.publisher
        return publisher.strip(" ,") if publisher else None

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
        languages = self.get_values("041", "a")
        return languages if languages else [DEFAULT_DOCUMENT_LANGUAGE]

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
    def locationUri(self) -> Optional[str]:
        values = self.get_values("856", "u", ind1="4", ind2="1")
        return values[0] if values else None

    @property
    def frequencies(self) -> List[Dict[str, Optional[str]]]:
        """Returns a list of dictionaries containing
        frequency and date information.

        Returns: List[Dict[str, str]]: List of dictionaries with keys
        "frequency" and "date"
        """
        frequencies_list = []
        for field in self.record.get_fields("310", "321"):
            subfields = field.subfields
            i = 0
            while i < len(subfields):
                frequency = subfields[i].value
                if i + 1 < len(subfields) and subfields[i + 1].code == "b":
                    while (
                        i + 1 < len(subfields) and subfields[i + 1].code == "b"
                    ):
                        frequencies_list.append(
                            {
                                "frequency": frequency,
                                "date": subfields[i + 1].value,
                            }
                        )
                        i += 1
                else:
                    frequencies_list.append({"frequency": frequency})
                i += 1
        return frequencies_list

    def parse_page_count(self, volume: Optional[str]) -> Optional[int]:
        return parse_page_count(self.extent, volume)

    def __str__(self) -> str:
        properties = [
            f"sysno: {self.sysno}",
            f"cnb: {self.cnb}",
            f"isxn: {self.isxn}",
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
            f"locationUri: {self.locationUri}",
            f"frequencies: {self.frequencies}",
        ]
        return "\n".join(properties)
