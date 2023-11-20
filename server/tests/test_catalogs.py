import unittest
from helper_funcs import setUpEnv

from catalogs.catalog_aleph import generate_record_by_identifier
from catalogs.enums import DigitizationState, MaterialType, IssuanceType
from documents.schemas import Identifier
from documents.enums import IdentifierType


class TestAlephCatalog(unittest.TestCase):
    def setUp(self):
        setUpEnv()

    def test_get_one_edition_record(self):
        identifier = Identifier(
            identifier_type=IdentifierType.SYSNO,
            value="MZK01-000724903"
        )
        record = generate_record_by_identifier(identifier)

        self.assertEqual(record.sysno, "MZK01-000724903")
        self.assertEqual(record.volume_number, None)
        self.assertEqual(record.item_number, None)
        self.assertEqual(record.material_type, MaterialType.book)
        self.assertEqual(record.pages_count, 755)
        self.assertEqual(record.size, "19 cm")
        self.assertEqual(record.signature, "1-0022.371")
        self.assertEqual(record.barcode, "2619213824")
        self.assertEqual(record.ccnb, "cnb002147995")
        self.assertEqual(record.isbn, None)
        self.assertEqual(record.periodicity, None)
        self.assertEqual(record.publishing_date, "1899")
        self.assertTrue(len(record.issues) == 1)
        self.assertEqual(record.issues[0].signature, "1-0022.371")
        self.assertEqual(record.issues[0].barcode, "2619213824")
        self.assertEqual(record.issues[0].issuance_type, IssuanceType.edition)
        self.assertEqual(record.issues[0].year_issued, None)
        self.assertEqual(record.issues[0].volume, None)
        self.assertEqual(record.issues[0].item, None)

    def test_get_multiple_issues_record(self):
        identifier = Identifier(
            identifier_type=IdentifierType.SYSNO,
            value="MZK01-001273598"
        )
        record = generate_record_by_identifier(identifier)

        self.assertEqual(record.sysno, "MZK01-001273598")
        self.assertEqual(record.volume_number, None)
        self.assertEqual(record.item_number, None)
        self.assertEqual(record.material_type,
                         MaterialType.continuing_resource)
        self.assertEqual(record.pages_count, None)
        self.assertEqual(record.size, "12 cm")
        self.assertEqual(record.signature, "CDR-1298.303")
        self.assertEqual(record.barcode, "2610534453")
        self.assertEqual(record.ccnb, None)
        self.assertEqual(record.isbn, None)
        self.assertEqual(record.periodicity, "3x%20ro%C4%8Dn%C4%9B")
        self.assertEqual(record.publishing_date, "2012-")
        self.assertTrue(len(record.issues) == 14)
        self.assertEqual(record.issues[0].signature, "CDR-1298.303")
        self.assertEqual(record.issues[0].barcode, "2610534453")
        self.assertEqual(record.issues[0].issuance_type, IssuanceType.item)
        self.assertEqual(record.issues[0].year_issued, "2012")
        self.assertEqual(record.issues[0].volume, "2012")
        self.assertEqual(record.issues[0].item, "1")


class TestDigitizationRegister(unittest.TestCase):
    def setUp(self):
        setUpEnv()

    def test_get_state_by_barcode(self):
        from catalogs.digitization_registry import get_state_by_identifier
        self.assertEqual(get_state_by_identifier(
            Identifier(identifier_type=IdentifierType.BARCODE,
                       value="2619213824")),
                         DigitizationState.FINISHED)
