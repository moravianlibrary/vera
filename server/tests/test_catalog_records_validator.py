import unittest
from tests.helper_funcs import mockClsEnv
from providers.catalog_records_validator import CatalogRecordsValidator
from catalogs.aleph_api import get_marc21_document


class TestCatalogRecordsValidator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def test_cnb_validity_with_valid_cnb(self):
        validator = CatalogRecordsValidator()
        self.assertTrue(
            validator.has_valid_cnb("MZK01-000771703", "cnb000696374")
        )

    def test_cnb_validity_without_connection_in_knihovny_cz(self):
        validator = CatalogRecordsValidator()
        self.assertTrue(
            validator.has_valid_cnb("MZK01-000919673", "cnb000566660")
        )

    def test_mzk_skc_record_comparison(self):
        # Arrange
        validator = CatalogRecordsValidator()
        mzk_sysno = "MZK01-000771703"

        # Act
        mzk_document = get_marc21_document(mzk_sysno)
        record_diff = validator.get_record_diff_against_skc(
            mzk_sysno, mzk_document
        )

        # Assert
        self.assertIsNotNone(record_diff)

    def test_mzk_skc_record_similarity(self):
        # Arrange
        validator = CatalogRecordsValidator()
        mzk_sysno = "MZK01-000771703"

        # Act
        similarity = validator.get_mzk_skc_similarity(mzk_sysno)

        # Assert
        self.assertIsNotNone(similarity)
        print(similarity)
