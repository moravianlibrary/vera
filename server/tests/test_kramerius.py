from tests.test_routines import TestRoutines
from unittest.mock import Mock, patch

from catalogs.routines import get_document_by_sysno
from kramerius.api import KrameriusApi
from kramerius.routines.find_missing_volumes import is_same_issue
from kramerius.search import KrameriusSearch


api = KrameriusApi()
kramerius_search = KrameriusSearch(api)


class TestFindMissingVolumes(TestRoutines):
    @patch(
        "kramerius.routines.find_missing_volumes"
        ".match_issuance_date_aleph_issue_kramerius_item"
    )
    def test_is_same_issue_1(
        self, mock_match_issuance_date_aleph_issue_kramerius_item: Mock
    ):
        # Arrange
        catalog_document, _ = get_document_by_sysno("MZK01-000732233")
        catalog_issue = [
            issue
            for issue in catalog_document.issues
            if issue.barcode == "2619592145"
        ][0]
        kramerius_document = kramerius_search.get_document(
            "uuid:0bf1b2c0-04d3-11e8-b1a1-005056827e52"
        )

        # Act
        is_same = is_same_issue(catalog_issue, kramerius_document)

        # Assert
        self.assertTrue(is_same)
        self.assertEqual(
            mock_match_issuance_date_aleph_issue_kramerius_item.call_count, 0
        )

    @patch(
        "kramerius.routines.find_missing_volumes"
        ".match_issuance_date_aleph_issue_kramerius_item"
    )
    def test_is_same_issue_2(
        self, mock_match_issuance_date_aleph_issue_kramerius_item: Mock
    ):
        # Arrange
        catalog_document, _ = get_document_by_sysno("MZK01-000745287")
        catalog_issue = [
            issue
            for issue in catalog_document.issues
            if issue.barcode == "2619548226"
        ][0]
        kramerius_document = kramerius_search.get_document(
            "uuid:fc771480-ab06-11ee-bd36-5ef3fc9bb22f"
        )

        # Act
        is_same = is_same_issue(catalog_issue, kramerius_document)

        # Assert
        self.assertTrue(is_same)
        self.assertEqual(
            mock_match_issuance_date_aleph_issue_kramerius_item.call_count, 1
        )

    def test_is_not_same_issue_1(self):
        # Arrange
        catalog_document, _ = get_document_by_sysno("MZK01-000732233")
        catalog_issue = [
            issue
            for issue in catalog_document.issues
            if issue.barcode == "2619592145"
        ][0]
        kramerius_document = kramerius_search.get_document(
            "uuid:8462dfb0-31a4-11e8-af9f-5ef3fc9bb22f"
        )

        # Act
        is_same = is_same_issue(catalog_issue, kramerius_document)

        # Assert
        self.assertFalse(is_same)

    def test_is_not_same_issue_2(self):
        # Arrange
        catalog_document, _ = get_document_by_sysno("MZK01-000798170")
        catalog_issue = [
            issue
            for issue in catalog_document.issues
            if issue.barcode == "2619573398"
        ][0]
        kramerius_document = kramerius_search.get_document(
            "uuid:0ab8c120-1ac1-11e7-981b-005056825209"
        )

        # Act
        is_same = is_same_issue(catalog_issue, kramerius_document)

        # Assert
        self.assertFalse(is_same)

    def test_is_missing_issue(self):
        # Arrange
        catalog_document, _ = get_document_by_sysno("MZK01-000719864")
        catalog_issue = [
            issue
            for issue in catalog_document.issues
            if issue.barcode == "2610337091"
        ][0]
        kramerius_document = kramerius_search.get_document(
            "uuid:010cc0b0-5367-11e8-946a-005056825209"
        )

        # Act
        is_missing = is_same_issue(catalog_issue, kramerius_document)

        # Assert
        self.assertFalse(is_missing)

    def test_find_missing_volumes_volume_years_in_title(self):
        # Arrange
        # pass
        from kramerius.routines.find_missing_volumes import (
            find_missing_periodical_volumes,
            write_output,
        )

        with open("/tmp/find_missing_volumes.csv", "w") as file:

            def write_line(periodical, catalog_document, issue):
                write_output(file, periodical, catalog_document, issue)

            find_missing_periodical_volumes(write_line)
