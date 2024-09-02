from ..base import TestEndpointsBase
from datatypes import ActionType


class TestCatalogRecordsEndpointsPermissions(TestEndpointsBase):
    def test_get_catalog_records_permitted(self):
        # Arange
        self.mockTestUser([ActionType.ReadCatalogRecords])
        # Act
        response = self.client.get("/catalog_records", headers=self.headers)
        # Assert
        self.assertEqual(response.status_code, 200)

    def test_get_catalog_records_prohibited(self):
        # Arange
        self.mockTestAntiUser([ActionType.ReadCatalogRecords])
        # Act
        response = self.client.get("/catalog_records", headers=self.headers)
        # Assert
        self.assertEqual(response.status_code, 403)

    def test_approve_catalog_record_difference_permitted(self):
        # Arange
        self.mockTestUser([ActionType.ReviewCatalogRecords])
        # Act
        response = self.client.patch(
            "/catalog_records/differences/1/approve", headers=self.headers
        )
        # Assert
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json()["detail"],
            "CatalogRecordFieldDifference with id 1 not found",
        )

    def test_approve_catalog_record_difference_prohibited(self):
        # Arange
        self.mockTestAntiUser([ActionType.ReviewCatalogRecords])
        # Act
        response = self.client.patch(
            "/catalog_records/differences/1/approve",
            headers={"Authorization": "Bearer test_token"},
        )
        # Assert
        self.assertEqual(response.status_code, 403)
