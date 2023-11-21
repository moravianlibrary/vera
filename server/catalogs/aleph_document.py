import re
from urllib.parse import quote
from documents import schemas
from catalogs.enums import DocumentCreateResult, MaterialType, IssuanceType
from typing import List, Optional, Tuple


MARC_NS = {"marc": "http://www.loc.gov/MARC21/slim"}

PAGE_COUNT_FORMAT = r'^(\d+) s.*'
SIZE_FORMAT = r'^(\d+) (cm).*'


def get_datafield(marc, tag, ind1=None, ind2=None):
    xpath = f'.//marc:datafield[@tag="{tag}"]'
    if ind1 is not None:
        xpath += f'[@ind1="{ind1}"]'
    if ind2 is not None:
        xpath += f'[@ind2="{ind2}"]'
    return marc.find(xpath, namespaces=MARC_NS)


def get_datafields(marc, tag, ind1=None, ind2=None):
    xpath = f'.//marc:datafield[@tag="{tag}"]'
    if ind1 is not None:
        xpath += f'[@ind1="{ind1}"]'
    if ind2 is not None:
        xpath += f'[@ind2="{ind2}"]'
    return marc.findall(xpath, namespaces=MARC_NS)


def get_subfield(datafield, code):
    return datafield.find(f'.//marc:subfield[@code="{code}"]',
                          namespaces=MARC_NS)


def get_subfield_text(datafield, code):
    subfield = get_subfield(datafield, code)
    return subfield.text if subfield is not None else None


def get_field(marc, tag, code, ind1=None, ind2=None):
    xpath = f'.//marc:datafield[@tag="{tag}"]'
    if ind1 is not None:
        xpath += f'[@ind1="{ind1}"]'
    if ind2 is not None:
        xpath += f'[@ind2="{ind2}"]'
    xpath += f'/marc:subfield[@code="{code}"]'
    return marc.find(xpath, namespaces=MARC_NS)


def get_fields(marc, tag, code, ind1=None, ind2=None):
    xpath = f'.//marc:datafield[@tag="{tag}"]'
    if ind1 is not None:
        xpath += f'[@ind1="{ind1}"]'
    if ind2 is not None:
        xpath += f'[@ind2="{ind2}"]'
    xpath += f'/marc:subfield[@code="{code}"]'
    return marc.findall(xpath, namespaces=MARC_NS)


def get_field_text(marc, tag, code, ind1=None, ind2=None):
    field = get_field(marc, tag, code, ind1, ind2)
    return field.text if field is not None else None


def get_fields_text(marc, tag, code, ind1=None, ind2=None):
    fields = get_fields(marc, tag, code, ind1, ind2)
    return [field.text for field in fields]


def get_field_text_for_tags(marc, tags, code, ind1=None, ind2=None):
    for tag in tags:
        text = get_field_text(marc, tag, code, ind1, ind2)
        if text is not None:
            return text
    return None


def encode(text: Optional[str]) -> [str]:
    return quote(text.encode('utf-8')) if text is not None else None


def get_first_encoded(texts: List[Optional[str]]) -> Optional[str]:
    for text in texts:
        encoded = encode(text)
        if encoded is not None:
            return encoded
    return None


def parse_page_count(extent: Optional[str]) -> Optional[int]:
    if extent is None:
        return None
    match = re.search(PAGE_COUNT_FORMAT, extent)
    return int(match.group(1)) if match else None


def parse_size(size: Optional[str]) -> Optional[str]:
    if size is None:
        return None
    match = re.search(SIZE_FORMAT, size)
    return re.sub(SIZE_FORMAT, r'\1 \2', size) if match else None


def parse_material_type(type: Optional[str]):
    if type is None:
        return None
    elif type == "BK":
        return MaterialType.book
    elif type == "CR" or type == "SE":
        return MaterialType.continuing_resource
    elif type == "MP":
        return MaterialType.map
    elif type == "MU":
        return MaterialType.music


class Issue:
    def __init__(self, marc_issue):
        self.barcode = get_subfield_text(marc_issue, "b")
        self.signature = get_subfield_text(marc_issue, "c")
        date_issued = get_subfield_text(marc_issue, "d")
        volume = get_subfield_text(marc_issue, "v")
        item = get_subfield_text(marc_issue, "i")
        year_issued = get_subfield_text(marc_issue, "y")

        self.year_issued = None
        self.volume = None
        self.item = None

        if date_issued is None:
            return

        date_issued_splitted = re.split("\\s+", date_issued)

        if len(date_issued_splitted) == 3 and date_issued_splitted[2] == item:
            self.item = item
        if 2 <= len(date_issued_splitted) and len(date_issued_splitted) <= 3 \
                and date_issued_splitted[0] == year_issued \
                and date_issued_splitted[1] == volume:
            self.volume = volume
            self.year_issued = year_issued
        elif len(date_issued_splitted) == 2 \
                and date_issued_splitted[1] == item \
                and date_issued_splitted[0] == year_issued \
                and date_issued_splitted[0] == volume:
            self.item = item
            self.volume = volume
            self.year_issued = year_issued
        else:
            self.item = None

    def get_schema(self):
        return schemas.Issue(
            signature=self.signature,
            year_issued=self.year_issued,
            volume=self.volume,
            item=self.item,
            barcode=self.barcode,
            issuance_type=IssuanceType.edition if self.volume is None else (
                IssuanceType.volume if self.item is None else IssuanceType.item
            )
        )


class CatalogDocument:
    def __init__(self, sysno, marc):
        self.sysno = sysno
        self.ccnb = get_field_text(marc, "015", "a")
        self.isbn = get_field_text(marc, "020", "a")

        self.title = get_field_text(marc, "245", "a")
        self.alternative_title = get_field_text(marc, "245", "b")
        self.part_number = get_field_text(marc, "245", "n")
        self.part_title = get_field_text(marc, "245", "p")
        self.edition = get_field_text(marc, "250", "a")

        self.publishers = get_fields_text(marc, "260", "b")
        self.publishers.extend(get_fields_text(marc, "264", "b"))
        # self.publishion_place = get_field_text_for_tags(marc, ["260", "264"],
        # "a")
        # self.publishers = get_field_text_for_tags(marc, ["260", "264"], "b")
        self.publishing_date = get_field_text_for_tags(
            marc, ["260", "264"], "c")

        self.extent = get_field_text(marc, "300", "a")
        self.additional_physical_data = get_field_text(marc, "300", "b")
        self.size = get_field_text(marc, "300", "c")
        self.periodicity = get_field_text(marc, "310", "a")
        self.issuance_data = get_field_text(marc, "362", "a")

        self.subtitle = get_field_text(marc, "490", "a")
        self.subtitle_version = get_field_text(marc, "490", "v")

        self.sigla = get_field_text(marc, "910", "a")
        self.signature = get_field_text(marc, "910", "b")
        self.additional_signature = get_field_text(marc, "910", "c")
        self.material_type = get_field_text(marc, "990", "a")
        self.barcode = get_field_text(marc, "996", "b")

        self.issues = [Issue(issue) for issue in get_datafields(marc, "996")]

    def get_schema(self) -> Tuple[schemas.DocumentCatalog,
                                  DocumentCreateResult]:
        title = get_first_encoded([self.title, self.alternative_title])
        if title is None:
            return None, DocumentCreateResult.CATALOG_DOCUMENT_PARSING_ERROR

        return schemas.DocumentCatalog(
            sysno=self.sysno,

            material_type=parse_material_type(self.material_type),
            publishers=[encode(p) for p in self.publishers],
            publishing_date=encode(self.publishing_date),

            title=title,
            pages_count=parse_page_count(self.extent),
            size=parse_size(self.size),
            periodicity=encode(self.periodicity),

            barcode=self.barcode,
            signature=get_first_encoded([self.signature,
                                         self.additional_signature]),
            ccnb=encode(self.ccnb),

            isbn=encode(self.isbn),

            issues=[issue.get_schema() for issue in self.issues]
        ), DocumentCreateResult.PREPARED
