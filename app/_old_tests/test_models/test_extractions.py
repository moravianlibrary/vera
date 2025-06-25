from .base import TestModelBase
from models import Extraction
from exceptions import EmptyExtractionException


class TestExtractionModelOperations(TestModelBase):
    def test_validate_before_save_pass_on_non_empty_document_ids(self):
        # Arrange
        extraction = Extraction(document_ids=[1, 2, 3])
        # Act and Assert
        self.assertIsNone(extraction.validate_before_save(self.session))

    def test_validate_before_save_fail_on_empty_document_ids(self):
        # Arrange
        extraction = Extraction(document_ids=[])
        # Act and Assert
        with self.assertRaises(EmptyExtractionException):
            extraction.validate_before_save(self.session)
