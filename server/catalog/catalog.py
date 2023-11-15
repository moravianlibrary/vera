import requests
from lxml import etree
import re
import services.exceptions as exceptions
from documents.schemas import Identifier
from catalog.catalog_record import CatalogRecord


ALEPH_ENDPOINT = "http://aleph.mzk.cz/OAI?verb=GetRecord\
    &identifier=oai:aleph.mzk.cz:{SYSNO}&metadataPrefix=marc21"

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
    return [generate_record_by_sysno(parse_sysno(line))
            for line in file_content.splitlines()]


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
    record = download_from_catalog(sysno)
    return CatalogRecord(sysno, record).get_schema()


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
    print(CatalogRecord("MZK01-000724903",
                        download_from_catalog("MZK01-000724903")).get_schema())
    print(CatalogRecord("MZK01-001273598",
                        download_from_catalog("MZK01-001273598")).get_schema())
    # if record.issues is not None and len(record.issues) > 0:
    #    for issue in record.get_schema().issues:
    #        print(f'{record.get_schema().sysno},{issue}')


if __name__ == "__main__":
    test()
