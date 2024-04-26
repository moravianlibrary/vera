from bs4 import BeautifulSoup
import re
from pymarc import Record, Field
from typing import Optional, Tuple

SYSNO_PATTERN = r"doc_no\s*=\s*\"(.*?)\""
MARC21_LEADER = "LDR"
MARC21_SYSNO = "SYS"
MARC21_FORMAT = "FMT"
MARC21_TAG_PATTERN = r"(\d{3})"


def skc_html_marc21_to_marc21(
    document: BeautifulSoup,
) -> Optional[Tuple[str, Record]]:
    record_table = document.find("table", id="record")
    if record_table is None:
        return None, None

    sysno, record = None, Record()

    for row in record_table.find_all("tr"):
        cols = row.find_all("td")
        if len(cols) != 2:
            raise ValueError

        field_text = cols[0].text.strip()
        values_text = cols[1].text.strip()

        if field_text == MARC21_LEADER:
            record.leader = values_text
        elif field_text == MARC21_SYSNO:
            sysno = values_text
        elif field_text == MARC21_FORMAT:
            continue
        elif not re.match(MARC21_TAG_PATTERN, field_text):
            # raise ValueError(field_text)
            continue

        # If is control field
        elif not values_text.startswith("|"):
            field = Field(tag=field_text, data=values_text)
            record.add_field(field)

        # If is data field
        else:
            datafield = field_text

            subfields = re.split(r"(?<!\|)\|(?!\|)", values_text)[1:]

            tag = datafield[0:3]
            ind1 = datafield[3] if len(datafield) > 3 else " "
            ind2 = datafield[4] if len(datafield) > 4 else " "

            field = Field(tag=tag, indicators=[ind1, ind2])

            for subfield in subfields:
                code = subfield[0]
                value = subfield[1:]
                field.add_subfield(code, value)

            record.add_field(field)

    return sysno, record


def parse_skc_sysno_from_document(document: BeautifulSoup) -> Optional[str]:
    document_str = str(document)
    match = re.search(SYSNO_PATTERN, document_str)
    return match.group(1) if match else None
