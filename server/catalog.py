import sys
from urllib.parse import quote
import requests
import xml.etree.ElementTree as ET
from lxml import etree
import re
import exceptions
from schemas import Identifier, RecordPrecreate
from catalog_record import CatalogRecord
from typing import Optional


ALEPH_ENDPOINT = "http://aleph.mzk.cz/OAI?verb=GetRecord&identifier=oai:aleph.mzk.cz:{SYSNO}&metadataPrefix=marc21"

SYSNO_FORMAT = r'^(?:MZK|mzk)(\d{2})-?(\d{9})$'
SYSNO_BASES = ["MZK01", "MZK03"]


def parse_sysno(sysno: str):
    if re.match(SYSNO_FORMAT, sysno):
        formatted = re.sub(SYSNO_FORMAT, r'MZK\1-\2', sysno)
        base = formatted.split("-")[0]
        if base in SYSNO_BASES:
            return formatted
        raise exceptions.InvalidSysnoBaseException(SYSNO_BASES, base)
    raise exceptions.InvalidSysnoException(SYSNO_FORMAT, sysno)


def generate_record_by_identifier(identifier: Identifier):
    if identifier.identifier_type == "sysno":
        return generate_record_by_sysno(parse_sysno(identifier.value))
    else:
        pass


def generate_records_from_file(file_content: str):
    return [generate_record_by_sysno(parse_sysno(line)) for line in file_content.splitlines()] 


def download_from_catalog(sysno: str):
    response = None
    try:
        response = requests.get(ALEPH_ENDPOINT.format(SYSNO=sysno))
    except Exception as e:
        print(f"An error occurred: {e}")

    if response.status_code != 200:
        print(f"HTTP request failed with status code {response.status_code}")

    return etree.fromstring(response.content)


def generate_record_by_sysno(sysno: str):
    response = None
    try:
        response = requests.get(ALEPH_ENDPOINT.format(SYSNO=sysno))
    except Exception as e:
        print(f"An error occurred: {e}")

    if response.status_code != 200:
        print(f"HTTP request failed with status code {response.status_code}")

    namespace = {"marc": "http://www.loc.gov/MARC21/slim"}

    xml_content = response.content
    root = ET.fromstring(xml_content)

    title = None
    subtitle = None
    volume = None
    signature = None
    issn = None
    isbn = None
    pages_count = None

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

    if title is None:
        return
    
    return RecordPrecreate(
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


def test():
    # sysno_file = "/home/robert/devel/digiboard/mzk01_sysnos.txt"
    # with open(sysno_file, 'r') as file:
    #     for line in file:
    #         sysno = line.strip()
    #         try:
    #             record = CatalogRecord(sysno, download_from_catalog(sysno))
    #             print(record.get_schema())
    #             if record.issues is not None and len(record.issues) > 0:
    #                 for issue in record.get_schema().issues:
    #                     print(f'{record.get_schema().sysno},{issue}')
    #         except Exception as e:
    #             print(e)
    # sysno_file = "/home/robert/devel/digiboard/mzk03_sysnos.txt"
    # with open(sysno_file, 'r') as file:
    #     for line in file:
    #         sysno = line.strip()
    #         try:
    #             record = CatalogRecord(sysno, download_from_catalog(sysno))
    #             print(record.get_schema())
    #             if record.issues is not None and len(record.issues) > 0:
    #                 for issue in record.get_schema().issues:
    #                     print(f'{record.get_schema().sysno},{issue}')
    #         except Exception as e:
    #             print(e)
    print(CatalogRecord("MZK01-000724903", download_from_catalog("MZK01-000724903")).get_schema())
    print(CatalogRecord("MZK01-001273598", download_from_catalog("MZK01-001273598")).get_schema())
    #if record.issues is not None and len(record.issues) > 0:
    #    for issue in record.get_schema().issues:
    #        print(f'{record.get_schema().sysno},{issue}')


if __name__ == "__main__":
    test()
