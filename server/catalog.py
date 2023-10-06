import sys
from urllib.parse import quote
import requests
import xml.etree.ElementTree as ET
import re
from schemas import Identifier, RecordPreCreate
from typing import Optional


ALEPH_ENDPOINT = "http://aleph.mzk.cz/OAI?verb=GetRecord&identifier=oai:aleph.mzk.cz:{SYSNO}&metadataPrefix=marc21"


def generate_record_by_identifier(identifier: Identifier):
    if identifier.identifier_type == "sysno":
        return generate_record_by_sysno(identifier.value)
    else:
        pass


def generate_record_by_sysno(sysno: str):
    response = None
    try:
        response = requests.get(ALEPH_ENDPOINT.format(SYSNO=sysno))
    except Exception as e:
        print(f"An error occurred: {e}")

    if response.status_code != 200:
        print(f"HTTP request failed with status code {response.status_code}")

    title = None
    subtitle = None
    volume = None
    signature = None
    issn = None
    isbn = None
    pages_count = None

    namespace = {"marc": "http://www.loc.gov/MARC21/slim"}

    xml_content = response.content
    root = ET.fromstring(xml_content)

    datafields = root.findall(".//marc:datafield", namespaces=namespace)

    for datafield in datafields:

        tag = datafield.get("tag")
        ind1 = datafield.get("ind1")
        ind2 = datafield.get("ind2")

        subfields = datafield.findall(".//marc:subfield", namespaces=namespace)

        for subfield in subfields:
            subfield_code = subfield.get("code")
            subfield_text = subfield.text

            if tag == "245" and subfield_code =="a":
                title = subfield_text
            if tag == "245" and subfield_code =="b":
                subtitle = subfield_text
            if tag == "245" and subfield_code =="p":
                volume = subfield_text
            if tag == "996" and subfield_code =="c":
                signature = subfield_text
            if tag == "996" and subfield_code =="b":
                barcode = subfield_text
            if tag == "300" and subfield_code =="a":
                numbers = re.findall(r'\d+', subfield_text)
                if len(numbers) == 1:
                    pages_count = numbers[0]
    
    title_result = ""
    if title is not None and title.strip() != "":
        title_result += title

    if subtitle is not None and subtitle.strip() != "":
        title_result += subtitle

    
    return RecordPreCreate(
        sysno=sysno,
        volume_number=quote(volume.encode('utf-8')) if volume is not None else None,
        item_number=None,
        title=quote(title_result.encode('utf-8')) if title is not None else None,
        pages_count=pages_count,
        signature=quote(signature.encode('utf-8')) if signature is not None else None,
        issn=None,
        isbn=None,
        barcode=None
    )


if __name__ == "__main__":
    print(generate_record_by_sysno(sys.argv[1]))
