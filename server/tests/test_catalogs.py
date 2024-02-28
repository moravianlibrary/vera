import unittest
from helper_funcs import setUpEnv

from catalogs.routines import generate_catalog_document
from catalogs.enums import (
    CatalogResponseStatus,
    DigitizationState,
    MaterialType,
    IdentifierType,
    IssuanceType,
)
from catalogs.schemas import Frequency, Identifier


class TestAlephCatalog(unittest.TestCase):
    def setUp(self):
        setUpEnv()

    def test_print_document(self):
        identifier = Identifier(
            identifier_type=IdentifierType.Sysno,
            # value="MZK01-000229421",
            value="MZK01-000724903",
            # value="MZK01-001884485",
        )
        response = generate_catalog_document(identifier)
        print(response.document)
        print(response.response_status)

    def test_get_one_edition_document(self):
        identifier = Identifier(
            identifier_type=IdentifierType.Sysno, value="MZK01-000724903"
        )
        catalog_response = generate_catalog_document(identifier)
        document = catalog_response.document
        response_status = catalog_response.response_status

        self.assertEqual(response_status, CatalogResponseStatus.Success)

        self.assertEqual(document.sysno, "MZK01-000724903")
        self.assertEqual(document.volume, None)
        self.assertEqual(document.material_type, MaterialType.Book)
        self.assertEqual(document.pages_count, 755)
        self.assertEqual(document.size, "19 cm")
        self.assertEqual(document.signature, "1-0022.371")
        self.assertEqual(document.barcode, "2619213824")
        self.assertEqual(document.cnb, "cnb002147995")
        self.assertEqual(document.isbn_issn, None)
        self.assertEqual(document.frequencies, [])
        self.assertEqual(document.publishing_year, "1899")
        self.assertTrue(len(document.issues) == 1)
        self.assertEqual(document.issues[0].signature, "1-0022.371")
        self.assertEqual(document.issues[0].barcode, "2619213824")
        self.assertEqual(document.issues[0].type, IssuanceType.Unit)
        self.assertEqual(document.issues[0].year, None)
        self.assertEqual(document.issues[0].volume, None)
        self.assertEqual(document.issues[0].bundle, None)

    def test_get_multiple_issues_document(self):
        identifier = Identifier(
            identifier_type=IdentifierType.Sysno, value="MZK01-001273598"
        )
        catalog_response = generate_catalog_document(identifier)
        document = catalog_response.document
        response_status = catalog_response.response_status

        self.assertEqual(response_status, CatalogResponseStatus.Success)

        self.assertEqual(document.sysno, "MZK01-001273598")
        self.assertEqual(document.volume, None)
        self.assertEqual(
            document.material_type, MaterialType.ContinuingResource
        )
        self.assertEqual(document.pages_count, None)
        self.assertEqual(document.size, "12 cm")
        self.assertEqual(document.signature, "CDR-1298.303")
        self.assertEqual(document.barcode, None)
        self.assertEqual(document.cnb, None)
        self.assertEqual(document.isbn_issn, None)
        self.assertEqual(
            document.frequencies,
            [
                Frequency(frequency="3x ročně", date="2016-"),
                Frequency(frequency="2x ročně,", date="2015"),
                Frequency(frequency="1x ročně,", date="2012-2014"),
            ],
        )
        self.assertEqual(document.publishing_year, "2012-")
        self.assertTrue(len(document.issues) == 14)
        self.assertEqual(document.issues[0].signature, "CDR-1298.303")
        self.assertEqual(document.issues[0].barcode, "2610534453")
        self.assertEqual(document.issues[0].type, IssuanceType.Bundle)
        self.assertEqual(document.issues[0].year, "2012")
        self.assertEqual(document.issues[0].volume, "2012")
        self.assertEqual(document.issues[0].bundle, "1")

    def test_find_document_by_barcode(self):
        identifier = Identifier(
            identifier_type=IdentifierType.Barcode, value="2610629074"
        )
        catalog_response = generate_catalog_document(identifier)
        document = catalog_response.document
        self.assertEqual(document.sysno, "MZK01-001449649")

    def test_find_document_by_signature(self):
        identifier = Identifier(
            identifier_type=IdentifierType.Signature, value="OB3-0114.497"
        )
        catalog_response = generate_catalog_document(identifier)
        document = catalog_response.document
        self.assertEqual(document.sysno, "MZK01-001091763")

    def test_find_document_by_signature_2(self):
        identifier = Identifier(
            identifier_type=IdentifierType.Signature, value="Bf3-0289.114"
        )
        catalog_response = generate_catalog_document(identifier)
        document = catalog_response.document
        self.assertEqual(document.sysno, "MZK01-001091763")

    def test_parse_frequencies(self):
        identifier = Identifier(
            identifier_type=IdentifierType.Sysno, value="MZK01-000230291"
        )
        catalog_response = generate_catalog_document(identifier)
        document = catalog_response.document
        self.assertEqual(document.sysno, "MZK01-000230291")
        print(document.frequencies)


class TestDigitizationRegister(unittest.TestCase):
    def setUp(self):
        setUpEnv()

    def test_get_state_by_barcode(self):
        from catalogs.digitization_registry import get_state_by_identifier

        self.assertEqual(
            get_state_by_identifier(
                Identifier(
                    identifier_type=IdentifierType.Barcode, value="2619213824"
                )
            ),
            DigitizationState.Finished,
        )

        self.assertEqual(
            get_state_by_identifier(
                Identifier(
                    identifier_type=IdentifierType.Barcode, value="2610280747"
                )
            ),
            DigitizationState.Finished,
        )

    def test_state_after_creating_document(self):
        from catalogs.enums import IdentifierType
        from catalogs.schemas import Identifier
        from documents.crud import get_document_by_identifiers, delete_document
        from documents.enums import DocumentCreateResult
        from documents.routines import create_catalog_document
        from services.database import get_db

        sysno = "MZK01-000369077"
        volume = "2005"
        barcode = "2610280747"
        identifier = Identifier(
            identifier_type=IdentifierType.Barcode, value=barcode
        )
        db = next(get_db())

        document = get_document_by_identifiers(sysno, volume, barcode, db)
        if document:
            delete_document(document.id, db)

        response = generate_catalog_document(identifier)
        result = create_catalog_document(
            response, identifier, None, False, "test_user", db
        )
        self.assertEqual(
            result.create_result, DocumentCreateResult.AlreadyDigitized
        )
