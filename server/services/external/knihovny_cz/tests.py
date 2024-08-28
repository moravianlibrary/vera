import unittest
from tests.helper_funcs import mockClsEnv
from services.external.knihovny_cz.client import KnihovnyCzClient
from services.external.knihovny_cz.types import KnihovnyCzField


class TestKnihovnyCz(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def test_get_record_marc(self):
        client = KnihovnyCzClient()
        document = client.get_knihovny_cz_document(
            "mzk.MZK01-000177790", [KnihovnyCzField.FullRecord]
        )
        self.assertEqual(
            document.marc21.get("015").get_subfields("a")[0], "cnb000104713"
        )

    def test_find_alternative_ids(self):
        client = KnihovnyCzClient()
        document = client.get_knihovny_cz_document(
            "mzk.MZK01-000177790", [KnihovnyCzField.PerLibraryIds]
        )
        self.assertEqual(
            document.per_library_ids,
            [
                "svkpk.PNA01-000618763",
                "nkp.NKC01-000104713",
                "caslin.SKC01-002369481",
                "mzk.MZK01-000177790",
                "vkol.SVK01-001207667",
                "svkhk.HKA01-000677321",
            ],
        )
