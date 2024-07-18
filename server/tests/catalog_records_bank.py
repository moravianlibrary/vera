from models import CatalogRecord
from pymarc import MARCReader
from services.external.aleph.record import AlephRecord


def get_test_catalog_records():
    catalog_records = []

    for sysno in [
        "MZK01-000121929",
        "MZK01-000155519",
        "MZK01-000157234",
        "MZK01-000164099",
        "MZK01-000220788",
        "MZK01-000299435",
        "MZK01-000345867",
        "MZK01-000393168",
        "MZK01-000567769",
        "MZK01-000572900",
        "MZK01-000585827",
        "MZK01-000642150",
        "MZK01-000753053",
        "MZK01-000771822",
        "MZK01-000899949",
        "MZK01-001293351",
        "MZK01-001334543",
        "MZK01-001337888",
        "MZK01-001343567",
        "MZK01-001343591",
        "MZK01-001343789",
        "MZK01-001345778",
        "MZK01-001355678",
        "MZK01-001371756",
        "MZK01-001651102",
        "MZK01-001714093",
        "MZK01-001897070",
        "MZK03-001175162",
        "MZK03-001186452",
    ]:
        with open(f"tests/aleph_records/{sysno}.marc", "rb") as marc_file:
            marc = marc_file.read()
            aleph_record = AlephRecord(
                sysno=sysno, record=next(MARCReader(marc))
            )
            catalog_records.append(
                CatalogRecord(
                    sysno=sysno,
                    marc=marc,
                    cnb=aleph_record.cnb,
                    isxn=aleph_record.isxn,
                    signature=aleph_record.signature,
                )
            )

    return catalog_records
