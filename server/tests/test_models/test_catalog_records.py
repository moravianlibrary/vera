from .base import TestModelBase
from models import (
    CatalogRecord,
    CatalogRecordBarcode,
    CatalogRecordFieldDifference,
    Document,
)
from datatypes import IdentifierType
from datetime import datetime
from exceptions import FieldDifferenceAlreadyApprovedException


TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


class TestCatalogRecordsModelProperties(TestModelBase):
    def test_main_record_parsing(self):
        # Arrange
        self.session.add(
            CatalogRecord(sysno="test_sysno", marc=TEST_MARC_BYTES)
        )

        # Act
        catalog_record = CatalogRecord.get(self.session, "test_sysno")

        # Assert
        self.assertIsNotNone(catalog_record.main_record)
        self.assertEqual(catalog_record.main_record["001"].data, "000121929")
        self.assertIsNone(catalog_record.skc_record)
        self.assertIsNone(catalog_record.cnb_record)

    def test_skc_record_parsing(self):
        # Arrange
        self.session.add(
            CatalogRecord(
                sysno="test_sysno",
                marc=TEST_MARC_BYTES,
                skc_marc=TEST_MARC_BYTES,
            )
        )

        # Act
        catalog_record = CatalogRecord.get(self.session, "test_sysno")

        # Assert
        self.assertIsNotNone(catalog_record.skc_record)
        self.assertEqual(catalog_record.skc_record["001"].data, "000121929")
        self.assertIsNone(catalog_record.cnb_record)

    def test_cnb_record_parsing(self):
        # Arrange
        self.session.add(
            CatalogRecord(
                sysno="test_sysno",
                marc=TEST_MARC_BYTES,
                cnb_marc=TEST_MARC_BYTES,
            )
        )

        # Act
        catalog_record = CatalogRecord.get(self.session, "test_sysno")

        # Assert
        self.assertIsNone(catalog_record.skc_record)
        self.assertIsNotNone(catalog_record.cnb_record)
        self.assertEqual(catalog_record.cnb_record["001"].data, "000121929")

    def test_has_valid_main_record_is_true_while_no_skc_differences_exists(
        self,
    ):
        # Arrange
        self.session.add(
            CatalogRecord(
                sysno="test_sysno",
                marc=TEST_MARC_BYTES,
                skc_marc=TEST_MARC_BYTES,
            )
        )

        # Act
        catalog_record = CatalogRecord.get(self.session, "test_sysno")

        # Assert
        self.assertTrue(catalog_record.has_valid_main_record)

    def test_has_valid_main_record_is_true_while_only_approved_skc_differences(
        self,
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno",
                    marc=TEST_MARC_BYTES,
                    skc_marc=TEST_MARC_BYTES,
                ),
                CatalogRecordFieldDifference(
                    sysno="test_sysno",
                    source="SKC",
                    tag="001",
                    approved_by="test_user",
                    difference_type="DifferentValue",
                ),
            ]
        )

        # Act
        catalog_record = CatalogRecord.get(self.session, "test_sysno")

        # Assert
        self.assertTrue(catalog_record.has_valid_main_record)

    def test_has_valid_main_record_is_false_while_skc_record_is_none(self):
        # Arrange
        self.session.add(
            CatalogRecord(sysno="test_sysno", marc=TEST_MARC_BYTES)
        )

        # Act
        catalog_record = CatalogRecord.get(self.session, "test_sysno")

        # Assert
        self.assertFalse(catalog_record.has_valid_main_record)

    def test_has_valid_main_record_is_false_while_unapproved_skc_differences(
        self,
    ):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(sysno="test_sysno", marc=TEST_MARC_BYTES),
                CatalogRecordFieldDifference(
                    sysno="test_sysno",
                    source="SKC",
                    tag="001",
                    difference_type="DifferentValue",
                ),
            ]
        )

        # Act
        catalog_record = CatalogRecord.get(self.session, "test_sysno")

        # Assert
        self.assertFalse(catalog_record.has_valid_main_record)

    def test_document_ids_parsing(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(sysno="test_sysno", marc=TEST_MARC_BYTES),
                CatalogRecord(sysno="test_sysno_2", marc=TEST_MARC_BYTES),
                CatalogRecord(sysno="test_sysno_3", marc=TEST_MARC_BYTES),
                Document(id=1, sysno="test_sysno"),
                Document(id=2, sysno="test_sysno_2"),
                Document(id=3, sysno="test_sysno", barcode="test_barcode"),
                Document(id=4, sysno="test_sysno_3"),
            ]
        )

        # Act
        catalog_record = CatalogRecord.get(self.session, "test_sysno")

        # Assert
        self.assertEqual(catalog_record.document_ids, [1, 3])


class TestCatalogRecordsModelFindByIdentifier(TestModelBase):
    def setUp(self):
        super().setUp()
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="test_sysno_1",
                    marc=TEST_MARC_BYTES,
                ),
                CatalogRecord(
                    sysno="test_sysno_2",
                    marc=TEST_MARC_BYTES,
                    cnb="test_cnb_2",
                    signature="test_signature_2",
                    isxn="test_isxn_2",
                ),
                CatalogRecordBarcode(
                    sysno="test_sysno_2",
                    barcode="test_barcode_2_1",
                ),
                CatalogRecordBarcode(
                    sysno="test_sysno_2",
                    barcode="test_barcode_2_2",
                ),
                CatalogRecord(
                    sysno="test_sysno_3",
                    marc=TEST_MARC_BYTES,
                ),
            ]
        )

    def test_find_by_sysno(self):
        # Act
        catalog_record = CatalogRecord.find_by_identifier(
            self.session, IdentifierType.Sysno, "test_sysno_2"
        )
        # Assert
        self.assertEqual(catalog_record.sysno, "test_sysno_2")

    def test_find_by_cnb(self):
        # Act
        catalog_record = CatalogRecord.find_by_identifier(
            self.session, IdentifierType.Cnb, "test_cnb_2"
        )
        # Assert
        self.assertEqual(catalog_record.sysno, "test_sysno_2")

    def test_find_by_signature(self):
        # Act
        catalog_record = CatalogRecord.find_by_identifier(
            self.session, IdentifierType.Signature, "test_signature_2"
        )
        # Assert
        self.assertEqual(catalog_record.sysno, "test_sysno_2")

    def test_find_by_isxn(self):
        # Act
        catalog_record = CatalogRecord.find_by_identifier(
            self.session, IdentifierType.Isxn, "test_isxn_2"
        )
        # Assert
        self.assertEqual(catalog_record.sysno, "test_sysno_2")

    def test_find_by_barcode(self):
        # Act
        catalog_record = CatalogRecord.find_by_identifier(
            self.session, IdentifierType.Barcode, "test_barcode_2_2"
        )
        # Assert
        self.assertEqual(catalog_record.sysno, "test_sysno_2")


class TestCatalogRecordBarcodesModelBasicOperations(TestModelBase):
    def test_save_successfully_while_unique_barcode(self):
        # Arrange
        self.session.add(
            CatalogRecord(sysno="test_sysno", marc=TEST_MARC_BYTES)
        )
        # Act
        catalog_record_barcode = CatalogRecordBarcode(
            sysno="test_sysno",
            barcode="test_barcode",
        ).save(self.session)
        # Assert
        self.assertEqual(catalog_record_barcode.sysno, "test_sysno")
        self.assertEqual(catalog_record_barcode.barcode, "test_barcode")

    def test_save_successfully_while_barcode_exists(self):
        # Arrange
        self.session.add(
            CatalogRecord(sysno="test_sysno", marc=TEST_MARC_BYTES),
            CatalogRecordBarcode(sysno="test_sysno", barcode="test_barcode"),
        )
        # Act
        catalog_record_barcode = CatalogRecordBarcode(
            sysno="test_sysno",
            barcode="test_barcode",
        ).save(self.session)
        # Assert
        self.assertEqual(catalog_record_barcode.sysno, "test_sysno")
        self.assertEqual(catalog_record_barcode.barcode, "test_barcode")

    def test_save_failure_while_invalid_sysno(self):
        from sqlalchemy.exc import IntegrityError

        # Act and Assert
        with self.assertRaises(IntegrityError):
            CatalogRecordBarcode(
                sysno="test_sysno",
                barcode="test_barcode",
            ).save(self.session)

    def test_delete_successfully_when_deleting_catalog_record(self):
        # Arrange
        self.session.add(
            CatalogRecord(sysno="test_sysno", marc=TEST_MARC_BYTES),
            CatalogRecordBarcode(sysno="test_sysno", barcode="test_barcode"),
        )
        # Act
        catalog_record = CatalogRecord.get(self.session, "test_sysno")
        catalog_record.delete(self.session)
        # Assert
        self.assertIsNone(self.session.query(CatalogRecordBarcode).first())


class TestCatalogRecordFieldDifferencesModel(TestModelBase):
    def setUp(self):
        super().setUp()
        self.session.add_all(
            [
                CatalogRecord(sysno="test_sysno", marc=TEST_MARC_BYTES),
                CatalogRecordFieldDifference(
                    sysno="test_sysno",
                    source="SKC",
                    tag="001",
                    difference_type="DifferentValue",
                ),
                CatalogRecordFieldDifference(
                    sysno="test_sysno",
                    source="CNB",
                    tag="100",
                    difference_type="ExtraField",
                    approved_by="test_user",
                    approved_at=datetime.now(),
                ),
            ]
        )

    def test_control_field_parsing(self):
        # Act and Assert
        self.assertTrue(
            CatalogRecordFieldDifference.get(self.session, 1).control_field
        )
        self.assertFalse(
            CatalogRecordFieldDifference.get(self.session, 2).control_field
        )

    def test_source_association_parsing(self):
        # Act and Assert
        self.assertTrue(
            CatalogRecordFieldDifference.get(self.session, 1).is_skc_difference
        )
        self.assertFalse(
            CatalogRecordFieldDifference.get(self.session, 1).is_cnb_difference
        )
        self.assertFalse(
            CatalogRecordFieldDifference.get(self.session, 2).is_skc_difference
        )
        self.assertTrue(
            CatalogRecordFieldDifference.get(self.session, 2).is_cnb_difference
        )

    def test_delete_successfully_deleting_unapproved_difference(self):
        # Act
        CatalogRecordFieldDifference.get(self.session, 1).delete(self.session)
        # Assert
        self.assertIsNone(CatalogRecordFieldDifference.find(self.session, 1))

    def test_delete_setting_flag_deleted_on_deleting_approved_difference(self):
        # Act
        CatalogRecordFieldDifference.get(self.session, 2).delete(self.session)
        # Assert
        self.assertTrue(
            CatalogRecordFieldDifference.get(self.session, 1).deleted
        )

    def test_approve_successfully_approving_unapproved_difference(self):
        # Act
        CatalogRecordFieldDifference.get(self.session, 1).approve(
            self.session, "test_user"
        )
        # Assert
        self.assertIsNotNone(
            CatalogRecordFieldDifference.get(self.session, 1).approved_by
        )
        self.assertIsNotNone(
            CatalogRecordFieldDifference.get(self.session, 1).approved_at
        )

    def test_approve_failing_approving_approved_difference(self):
        # Act and Assert
        with self.assertRaises(FieldDifferenceAlreadyApprovedException):
            CatalogRecordFieldDifference.get(self.session, 2).approve(
                self.session, "test_user"
            )
