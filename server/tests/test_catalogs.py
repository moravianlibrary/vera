import unittest
from helper_funcs import setUpEnv

from catalogs.catalog_aleph import generate_document_by_identifier
from catalogs.enums import DigitizationState, DocumentCreateResult, \
    MaterialType, IssuanceType
from documents.schemas import Identifier
from documents.enums import IdentifierType


class TestAlephCatalog(unittest.TestCase):
    def setUp(self):
        setUpEnv()

    def test_get_one_edition_document(self):
        identifier = Identifier(
            identifier_type=IdentifierType.SYSNO,
            value="MZK01-000724903"
        )
        document, create_result = generate_document_by_identifier(identifier)

        self.assertEqual(create_result, DocumentCreateResult.PREPARED)

        self.assertEqual(document.sysno, "MZK01-000724903")
        self.assertEqual(document.volume_number, None)
        self.assertEqual(document.material_type, MaterialType.book)
        self.assertEqual(document.pages_count, 755)
        self.assertEqual(document.size, "19 cm")
        self.assertEqual(document.signature, "1-0022.371")
        self.assertEqual(document.barcode, "2619213824")
        self.assertEqual(document.ccnb, "cnb002147995")
        self.assertEqual(document.isbn, None)
        self.assertEqual(document.periodicity, None)
        self.assertEqual(document.publishing_date, "1899")
        self.assertTrue(len(document.issues) == 1)
        self.assertEqual(document.issues[0].signature, "1-0022.371")
        self.assertEqual(document.issues[0].barcode, "2619213824")
        self.assertEqual(document.issues[0].issuance_type,
                         IssuanceType.edition)
        self.assertEqual(document.issues[0].year_issued, None)
        self.assertEqual(document.issues[0].volume, None)
        self.assertEqual(document.issues[0].item, None)

    def test_get_multiple_issues_document(self):
        identifier = Identifier(
            identifier_type=IdentifierType.SYSNO,
            value="MZK01-001273598"
        )
        document, create_result = generate_document_by_identifier(identifier)

        self.assertEqual(create_result, DocumentCreateResult.PREPARED)

        self.assertEqual(document.sysno, "MZK01-001273598")
        self.assertEqual(document.volume_number, None)
        self.assertEqual(document.material_type,
                         MaterialType.continuing_resource)
        self.assertEqual(document.pages_count, None)
        self.assertEqual(document.size, "12 cm")
        self.assertEqual(document.signature, "CDR-1298.303")
        self.assertEqual(document.barcode, "2610534453")
        self.assertEqual(document.ccnb, None)
        self.assertEqual(document.isbn, None)
        self.assertEqual(document.periodicity, "3x%20ro%C4%8Dn%C4%9B")
        self.assertEqual(document.publishing_date, "2012-")
        self.assertTrue(len(document.issues) == 14)
        self.assertEqual(document.issues[0].signature, "CDR-1298.303")
        self.assertEqual(document.issues[0].barcode, "2610534453")
        self.assertEqual(document.issues[0].issuance_type, IssuanceType.item)
        self.assertEqual(document.issues[0].year_issued, "2012")
        self.assertEqual(document.issues[0].volume, "2012")
        self.assertEqual(document.issues[0].item, "1")

    def test_find_document_by_barcode(self):
        identifier = Identifier(
            identifier_type=IdentifierType.BARCODE,
            value="2610629074"
        )
        document, create_result = generate_document_by_identifier(identifier)
        self.assertEqual(document.sysno, "MZK01-001449649")


class TestDigitizationRegister(unittest.TestCase):
    def setUp(self):
        setUpEnv()

    def test_get_state_by_barcode(self):
        from catalogs.digitization_registry import get_state_by_identifier
        self.assertEqual(get_state_by_identifier(
            Identifier(identifier_type=IdentifierType.BARCODE,
                       value="2619213824")),
                         DigitizationState.FINISHED)
