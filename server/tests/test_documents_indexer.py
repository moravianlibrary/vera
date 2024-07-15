from tests.test_crud import TestCrudOperations
from services.documents_indexer import DocumentsIndexer
from services.external.aleph.client import AlephClient
from tests.catalog_records_bank import get_test_catalog_records


class TestDocumentsIndexer(TestCrudOperations):
    def setUp(self):
        pass

    def tearDown(self) -> None:
        pass

    def test_index_document(self):
        # Arrange
        client = AlephClient()
        sysnos = [
            "MZK01-000121929",
            "MZK01-000155519",
            "MZK01-000157234",
            "MZK01-000164099",
            # "MZK01-000196508",
            "MZK01-000220788",
            # "MZK01-000225480",
            "MZK01-000299435",
            "MZK01-000345867",
            "MZK01-000393168",
            # "MZK01-000394365",
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
        ]
        for sysno in sysnos:
            record, status = client.get_record(sysno)
            print(f"Getting record for {sysno}: {status}")
            with open(f"tests/aleph_records/{sysno}.marc", "wb") as f:
                f.write(record.record.as_marc())

        print(get_test_catalog_records())
