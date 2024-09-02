from .base import TestModelBase
from models import CatalogRecord, DigitizationList, Document, Intention
from datetime import date, timedelta, datetime
from exceptions import (
    CannotExtractDocumentWithInvalidCnb,
    CannotExtractDocumentWithInvalidMainRecord,
    CannotExtractDocumentWithoutPageCount,
    DocumentAlreadyExtractedException,
)


TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


class TestDepartmentsModel(TestModelBase):
    def setUp(self):
        super().setUp()
        self.session.add(
            Intention(
                name="test_intention",
                target_page_count=10,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=1),
            )
        )
        self.session.flush()
        self.session.add_all(
            [
                DigitizationList(
                    intention_id=1,
                    created_by="test_user",
                    created_at=datetime.now(),
                ),
                CatalogRecord(
                    sysno="test_sysno",
                    cnb="test_cnb",
                    marc=TEST_MARC_BYTES,
                    skc_marc=TEST_MARC_BYTES,
                    cnb_marc=TEST_MARC_BYTES,
                    language="cze",
                ),
                Document(
                    sysno="test_sysno",
                    digitization_list_id=1,
                    pages_count_catalog=10,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode",
                    digitization_list_id=1,
                    pages_count_predicted=11,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_2",
                    digitization_list_id=1,
                    pages_count_manual=12,
                ),
            ]
        )

    def test_document_ids_parsing(self):
        # Act and Assert
        self.assertEqual(
            DigitizationList.get(self.session, 1).document_ids, [1, 2, 3]
        )

    def test_page_count_parsing(self):
        # Act and Assert
        self.assertEqual(DigitizationList.get(self.session, 1).page_count, 33)

    def test_get_all_filtered_by_intention(self):
        # Arrange
        self.session.add(
            Intention(
                name="test_intention_2",
                target_page_count=10,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=1),
            )
        )
        self.session.flush()
        self.session.add_all(
            [
                DigitizationList(
                    intention_id=2,
                    created_by="test_user",
                    created_at=datetime.now(),
                ),
                DigitizationList(
                    intention_id=1,
                    created_by="test_user",
                    created_at=datetime.now(),
                ),
            ]
        )
        # Act and Assert
        self.assertEqual(
            [d.id for d in DigitizationList.get_by_intention(self.session, 1)],
            [1, 3],
        )

    def test_add_documents_successfully(self):
        # Arrange
        self.session.add_all(
            [
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_3",
                    pages_count_manual=12,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_4",
                    pages_count_manual=13,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_5",
                    pages_count_manual=14,
                ),
            ]
        )
        # Act
        DigitizationList.get(self.session, 1).add_documents(
            self.session, [4, 6]
        )
        # Assert
        self.assertEqual(
            DigitizationList.get(self.session, 1).document_ids, [1, 2, 3, 4, 6]
        )

    def test_add_documents_fail_while_adding_document_with_invalid_main_record(
        self,
    ):
        # Arrange
        CatalogRecord.get(self.session, "test_sysno").skc_marc = None
        self.session.add(
            Document(
                sysno="test_sysno",
                barcode="test_barcode_3",
                pages_count_manual=12,
            )
        )
        # Act and Assert
        with self.assertRaises(CannotExtractDocumentWithInvalidMainRecord):
            DigitizationList.get(self.session, 1).add_documents(
                self.session, [4]
            )

    def test_add_documents_fail_while_adding_document_without_cnb(
        self,
    ):
        # Arrange
        CatalogRecord.get(self.session, "test_sysno").cnb_marc = None
        self.session.add(
            Document(
                sysno="test_sysno",
                barcode="test_barcode_3",
                pages_count_manual=12,
            )
        )
        # Act and Assert
        with self.assertRaises(CannotExtractDocumentWithInvalidCnb):
            DigitizationList.get(self.session, 1).add_documents(
                self.session, [4]
            )

    def test_add_documents_fail_while_adding_document_without_page_count(
        self,
    ):
        # Arrange
        self.session.add(
            Document(
                sysno="test_sysno",
                barcode="test_barcode_3",
            )
        )
        # Act and Assert
        with self.assertRaises(CannotExtractDocumentWithoutPageCount):
            DigitizationList.get(self.session, 1).add_documents(
                self.session, [4]
            )

    def test_add_documents_fail_while_adding_document_that_is_already_listed(
        self,
    ):
        # Arrange
        self.session.add_all(
            [
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_3",
                    pages_count_manual=12,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_4",
                    pages_count_manual=13,
                ),
                Document(
                    sysno="test_sysno",
                    barcode="test_barcode_5",
                    pages_count_manual=14,
                ),
            ]
        )
        # Act and Assert
        with self.assertRaises(DocumentAlreadyExtractedException):
            DigitizationList.get(self.session, 1).add_documents(
                self.session, [1]
            )

    def test_remove_documents_successfully(self):
        # Act
        digitization_list = DigitizationList.get(self.session, 1)
        digitization_list.remove_documents(self.session, [1, 2])
        # Assert
        self.assertEqual(
            DigitizationList.get(self.session, 1).document_ids, [3]
        )

    def test_remove_documents_successfully_even_with_non_listed_documents(
        self,
    ):
        # Arrange
        self.session.add(
            Document(
                sysno="test_sysno",
                barcode="test_barcode_3",
                pages_count_manual=12,
            )
        )
        # Act
        digitization_list = DigitizationList.get(self.session, 1)
        digitization_list.remove_documents(self.session, [2, 4])
        # Assert
        self.assertEqual(
            DigitizationList.get(self.session, 1).document_ids, [1, 3]
        )
