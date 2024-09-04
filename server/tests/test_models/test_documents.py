from unittest.mock import patch, Mock
from .base import TestModelBase
from models import (
    CatalogRecord,
    Document,
    DigitizationList,
    Intention,
    Category,
)
from exceptions import (
    CannotExtractDocumentWithInvalidCnb,
    CannotExtractDocumentWithInvalidMainRecord,
    CannotExtractDocumentWithoutPageCount,
    DocumentAlreadyExtractedException,
)
from datetime import date, timedelta


TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


class TestDocumentModelPropertiesParsing(TestModelBase):
    def test_cnb_parsing(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno", marc=TEST_MARC_BYTES, cnb="test_cnb"
                ),
                Document(sysno="test_sysno"),
            ]
        )
        # Act and Assert
        self.assertEqual(Document.get(self.session, 1).cnb, "test_cnb")

    def test_signature_parsing_from_catalog_record(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                    signature="test_signature",
                ),
                Document(sysno="test_sysno"),
            ]
        )
        # Act and Assert
        self.assertEqual(
            Document.get(self.session, 1).signature, "test_signature"
        )

    def test_signature_parsing_from_document_signature(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                    signature="test_signature",
                ),
                Document(
                    sysno="test_sysno",
                    document_signature="test_document_signature",
                ),
            ]
        )
        # Act and Assert
        self.assertEqual(
            Document.get(self.session, 1).signature, "test_document_signature"
        )

    def test_isxn_parsing(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                    isxn="test_isxn",
                ),
                Document(sysno="test_sysno"),
            ]
        )
        # Act and Assert
        self.assertEqual(Document.get(self.session, 1).isxn, "test_isxn")

    def test_page_count_parsing_from_manual_page_count(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    pages_count_manual=10,
                    pages_count_predicted=11,
                    pages_count_catalog=12,
                ),
            ]
        )
        # Act and Assert
        self.assertEqual(Document.get(self.session, 1).pages_count, 10)

    def test_page_count_parsing_from_catalog_page_count(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    pages_count_catalog=11,
                    pages_count_predicted=12,
                ),
            ]
        )
        # Act and Assert
        self.assertEqual(Document.get(self.session, 1).pages_count, 11)

    def test_page_count_parsing_from_predicted_page_count(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    pages_count_predicted=12,
                ),
            ]
        )
        # Act and Assert
        self.assertEqual(Document.get(self.session, 1).pages_count, 12)

    def test_category_name_parsing(self):
        # Arrange
        self.session.add(
            Category(
                name="test_category_name",
            )
        )
        self.session.flush()
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(sysno="test_sysno", category_id=1),
            ]
        )
        # Act and Assert
        self.assertEqual(
            Document.get(self.session, 1).category_name, "test_category_name"
        )

    def test_category_path_parsing(self):
        # Arrange
        self.session.add(
            Category(
                name="test_root_category_name",
            )
        )
        self.session.flush()
        self.session.add(
            Category(
                name="test_child_category_name",
                parent_id=1,
            )
        )
        self.session.flush()
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(sysno="test_sysno", category_id=2),
            ]
        )
        # Act and Assert
        self.assertEqual(
            Document.get(self.session, 1).category_path,
            [
                {"category_id": 1, "category_name": "test_root_category_name"},
                {
                    "category_id": 2,
                    "category_name": "test_child_category_name",
                },
            ],
        )

    def test_digitization_list_properties_parsing(self):
        # Arrange
        self.session.add(
            Intention(
                name="test_intention",
                target_page_count=10,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=1),
            )
        )
        self.session.flush()
        self.session.add(
            DigitizationList(intention_id=1, created_by="test_user")
        )
        self.session.flush()
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    digitization_list_id=1,
                    pages_count_predicted=10,
                ),
            ]
        )
        # Act and Assert
        self.assertEqual(
            Document.get(self.session, 1).digitization_list_created_by,
            "test_user",
        )
        self.assertIsNotNone(
            Document.get(self.session, 1).digitization_list_created_at
        )


class TestDocumentModelExtractionPropertiesParsing(TestModelBase):
    def test_is_extractable_parsing_false_when_page_count_is_none(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        # Act and Assert
        self.assertFalse(Document.get(self.session, 1).is_extractable)

    def test_is_extractable_parsing_false_when_page_count_is_zero(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    pages_count_predicted=0,
                ),
            ]
        )
        # Act and Assert
        self.assertFalse(Document.get(self.session, 1).is_extractable)

    @patch("models.catalog_records.CatalogRecord.has_valid_main_record")
    def test_is_extractable_parsing_false_when_main_record_is_invalid(
        self, mock_has_valid_main_record: Mock
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        mock_has_valid_main_record.return_value = False
        # Act and Assert
        self.assertFalse(Document.get(self.session, 1).is_extractable)

    @patch("models.catalog_records.CatalogRecord.has_valid_cnb")
    def test_is_extractable_parsing_false_when_cnb_is_invalid(
        self, mock_has_valid_cnb: Mock
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        mock_has_valid_cnb.return_value = False
        # Act and Assert
        self.assertFalse(Document.get(self.session, 1).is_extractable)

    def test_is_extractable_parsing_false_when_is_already_extracted(self):
        # Arrange
        self.session.add(
            Intention(
                name="test_intention",
                target_page_count=10,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=1),
            )
        )
        self.session.flush()
        self.session.add(
            DigitizationList(intention_id=1, created_by="test_user")
        )
        self.session.flush()
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    digitization_list_id=1,
                ),
            ]
        )
        # Act and Assert
        self.assertFalse(Document.get(self.session, 1).is_extractable)

    @patch("models.catalog_records.CatalogRecord.has_valid_main_record")
    @patch("models.catalog_records.CatalogRecord.has_valid_cnb")
    def test_is_extractable_parsing_true(
        self, mock_has_valid_cnb: Mock, mock_has_valid_main_record: Mock
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    pages_count_predicted=10,
                ),
            ]
        )
        mock_has_valid_main_record.return_value = True
        mock_has_valid_cnb.return_value = True
        # Act and Assert
        self.assertTrue(Document.get(self.session, 1).is_extractable)

    @patch("models.catalog_records.CatalogRecord.has_valid_main_record")
    @patch("models.catalog_records.CatalogRecord.has_valid_cnb")
    def test_raise_exception_when_page_count_is_none(
        self, mock_has_valid_cnb: Mock, mock_has_valid_main_record: Mock
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        mock_has_valid_main_record.return_value = True
        mock_has_valid_cnb.return_value = True
        # Act and Assert
        with self.assertRaises(CannotExtractDocumentWithoutPageCount):
            Document.get(self.session, 1).raise_for_extractibility(set())

    @patch("models.catalog_records.CatalogRecord.has_valid_main_record")
    @patch("models.catalog_records.CatalogRecord.has_valid_cnb")
    def test_raise_exception_when_page_count_is_zero(
        self, mock_has_valid_cnb: Mock, mock_has_valid_main_record: Mock
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    pages_count_predicted=0,
                ),
            ]
        )
        mock_has_valid_main_record.return_value = True
        mock_has_valid_cnb.return_value = True
        # Act and Assert
        with self.assertRaises(CannotExtractDocumentWithoutPageCount):
            Document.get(self.session, 1).raise_for_extractibility(set())

    def test_raise_exception_when_main_record_is_invalid(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        # Act and Assert
        with self.assertRaises(CannotExtractDocumentWithInvalidMainRecord):
            Document.get(self.session, 1).raise_for_extractibility(set())

    @patch("models.catalog_records.CatalogRecord.has_valid_main_record")
    def test_raise_exception_when_cnb_is_invalid(
        self, mock_has_valid_main_record: Mock
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        mock_has_valid_main_record.return_value = True
        # Act and Assert
        with self.assertRaises(CannotExtractDocumentWithInvalidCnb):
            Document.get(self.session, 1).raise_for_extractibility(set())

    @patch("models.catalog_records.CatalogRecord.has_valid_main_record")
    @patch("models.catalog_records.CatalogRecord.has_valid_cnb")
    def test_raise_exception_when_document_is_already_extracted(
        self, mock_has_valid_cnb: Mock, mock_has_valid_main_record: Mock
    ):
        # Arrange
        self.session.add(
            Intention(
                name="test_intention",
                target_page_count=10,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=1),
            )
        )
        self.session.flush()
        self.session.add(
            DigitizationList(intention_id=1, created_by="test_user")
        )
        self.session.flush()
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    digitization_list_id=1,
                    pages_count_predicted=10,
                ),
            ]
        )
        mock_has_valid_main_record.return_value = True
        mock_has_valid_cnb.return_value = True
        # Act and Assert
        with self.assertRaises(DocumentAlreadyExtractedException):
            Document.get(self.session, 1).raise_for_extractibility(set())

    @patch("models.catalog_records.CatalogRecord.has_valid_main_record")
    @patch("models.catalog_records.CatalogRecord.has_valid_cnb")
    def test_do_not_raise_exception_when_document_is_extractable(
        self, mock_has_valid_cnb: Mock, mock_has_valid_main_record: Mock
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    pages_count_predicted=10,
                ),
            ]
        )
        mock_has_valid_main_record.return_value = True
        mock_has_valid_cnb.return_value = True
        # Act and Assert
        self.assertIsNone(
            Document.get(self.session, 1).raise_for_extractibility(set())
        )


class TestDocumentModelOperations(TestModelBase):
    def setUp(self):
        super().setUp()

    def test_find(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        # Act and Assert
        self.assertIsNotNone(Document.find(self.session, 1).id)

    def test_validate_before_save_pass_on_document_with_barcode(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        document = Document(
            sysno="test_sysno",
            barcode="test_barcode",
        )
        # Act and Assert
        self.assertIsNone(document.validate_before_save(self.session))

    def test_validate_before_save_fail_on_document_with_barcode_duplicity(
        self,
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode",
                ),
            ]
        )
        document = Document(
            sysno="test_sysno",
            barcode="test_barcode",
        )
        # Act and Assert
        with self.assertRaises(ValueError):
            document.validate_before_save(self.session)

    def test_validate_before_save_pass_on_document_with_edition(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    volume="test_volume",
                    volume_year="test_volume_year",
                    bundle="test_bundle",
                ),
            ]
        )
        document = Document(
            sysno="test_sysno",
            volume="test_volume",
            volume_year="test_volume_year",
        )
        # Act and Assert
        self.assertIsNone(document.validate_before_save(self.session))

    def test_validate_before_save_fail_on_document_with_edition_duplicity(
        self,
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    volume="test_volume",
                    volume_year="test_volume_year",
                    bundle="test_bundle",
                ),
            ]
        )
        document = Document(
            sysno="test_sysno",
            volume="test_volume",
            volume_year="test_volume_year",
            bundle="test_bundle",
        )
        # Act and Assert
        with self.assertRaises(ValueError):
            document.validate_before_save(self.session)

    def test_validate_before_save_pass_on_document_with_sysno(self):
        # Arrange
        self.session.add(
            CatalogRecord(
                sysno="test_sysno",
                marc=TEST_MARC_BYTES,
            )
        )
        document = Document(
            sysno="test_sysno",
        )
        # Act and Assert
        self.assertIsNone(document.validate_before_save(self.session))

    def test_validate_before_save_fail_on_document_with_sysno_duplicity(
        self,
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        document = Document(
            sysno="test_sysno",
        )
        # Act and Assert
        with self.assertRaises(ValueError):
            document.validate_before_save(self.session)

    def test_exists_is_false_when_barcode_is_not_none(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        # Act and Assert
        self.assertFalse(
            Document.exists(self.session, "test_sysno", barcode="test_barcode")
        )

    def test_exists_is_true_when_barcode_is_not_none(
        self,
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode",
                ),
            ]
        )
        # Act and Assert
        self.assertTrue(
            Document.exists(self.session, "test_sysno", barcode="test_barcode")
        )

    def test_exists_is_false_when_edition_is_not_none(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    volume="test_volume",
                    volume_year="test_volume_year",
                    bundle="test_bundle",
                ),
            ]
        )
        # Act and Assert
        self.assertFalse(
            Document.exists(
                self.session,
                "test_sysno",
                volume="test_volume",
                volume_year="test_volume_year",
            )
        )

    def test_exists_is_true_when_edition_is_not_none(
        self,
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    volume="test_volume",
                    volume_year="test_volume_year",
                    bundle="test_bundle",
                ),
            ]
        )
        # Act and Assert
        self.assertTrue(
            Document.exists(
                self.session,
                "test_sysno",
                volume="test_volume",
                volume_year="test_volume_year",
                bundle="test_bundle",
            )
        )

    def test_exists_is_false_when_document_with_only_sysno(self):
        # Arrange
        self.session.add(
            CatalogRecord(
                sysno="test_sysno",
                marc=TEST_MARC_BYTES,
            )
        )
        # Act and Assert
        self.assertFalse(Document.exists(self.session, "test_sysno"))

    def test_exists_is_true_when_document_with_only_sysno(
        self,
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                ),
            ]
        )
        # Act and Assert
        self.assertTrue(Document.exists(self.session, "test_sysno"))

    def test_get_extractable_documents_with_different_priorities(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                    skc_marc=TEST_MARC_BYTES,
                    cnb_marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_1",
                    pages_count_catalog=10,
                    extraction_priority=1,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_2",
                    pages_count_catalog=10,
                    extraction_priority=3,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_3",
                    pages_count_catalog=10,
                    extraction_priority=5,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_1",
                    pages_count_catalog=10,
                    extraction_priority=4,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_5",
                    pages_count_catalog=10,
                    extraction_priority=2,
                ),
            ]
        )
        # Act and Assert
        self.assertEqual(
            [
                d.id
                for d in Document.get_extractable_documents(
                    self.session, None, [], set()
                )
            ],
            [3, 4, 2, 5, 1],
        )

    def test_get_extractable_documents_based_on_location(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                    skc_marc=TEST_MARC_BYTES,
                    cnb_marc=TEST_MARC_BYTES,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_1",
                    pages_count_catalog=10,
                    extraction_priority=1,
                    document_signature="2-1",
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_2",
                    pages_count_catalog=10,
                    extraction_priority=3,
                    document_signature="3-1",
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_3",
                    pages_count_catalog=10,
                    extraction_priority=5,
                    document_signature="3-1",
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_1",
                    pages_count_catalog=10,
                    extraction_priority=4,
                    document_signature="2-1",
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_5",
                    pages_count_catalog=10,
                    extraction_priority=2,
                    document_signature="1-1",
                ),
            ]
        )
        # Act and Assert
        self.assertEqual(
            [
                d.id
                for d in Document.get_extractable_documents(
                    self.session, None, ["^1-.*$", "^2-.*$"], set()
                )
            ],
            [4, 5, 1],
        )

    def test_get_extractable_documents_based_on_record_location(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno_1",
                    marc=TEST_MARC_BYTES,
                    skc_marc=TEST_MARC_BYTES,
                    cnb_marc=TEST_MARC_BYTES,
                    signature="1-1",
                ),
                CatalogRecord(
                    sysno="test_sysno_2",
                    marc=TEST_MARC_BYTES,
                    skc_marc=TEST_MARC_BYTES,
                    cnb_marc=TEST_MARC_BYTES,
                    signature="2-1",
                ),
                Document(
                    sysno="test_sysno_1",
                    pages_count_catalog=10,
                ),
                Document(
                    sysno="test_sysno_2",
                    pages_count_catalog=10,
                ),
            ]
        )
        # Act and Assert
        self.assertEqual(
            [
                d.id
                for d in Document.get_extractable_documents(
                    self.session, None, ["^1-.*$"], set()
                )
            ],
            [1],
        )
