from ..base import TestEndpointsBase
from datatypes import ActionType


class TestDigitizationListsIntegration(TestEndpointsBase):
    def test_create_extraction_permitted(self):
        # Arrange
        self.mockTestUser([ActionType.Extract])
        # Act
        response = self.client.post(
            "/extractions/digitization?intention_id=1",
            json={},
            headers=self.json_headers,
        )
        # Assert
        self.assertEqual(503, response.status_code)

    def test_create_extraction_prohibited(self):
        # Arrange
        self.mockTestAntiUser([ActionType.Extract])
        # Act
        response = self.client.post(
            "/extractions/digitization?intention_id=1",
            headers=self.headers,
        )
        # Assert
        self.assertEqual(403, response.status_code)

    def test_get_extractions_permitted(self):
        # Arrange
        self.mockTestUser([ActionType.Extract])
        # Act
        response = self.client.get(
            "/extractions/digitization", headers=self.headers
        )
        # Assert
        self.assertEqual(200, response.status_code)

    def test_get_extraction_permitted(self):
        # Arrange
        self.mockTestUser([ActionType.Extract])
        # Act
        response = self.client.get(
            "/extractions/digitization/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        # Assert
        self.assertEqual(404, response.status_code)

    def test_add_documents_to_digitization_list_permitted(self):
        # Arrange
        self.mockTestUser([ActionType.Extract])
        # Act
        response = self.client.put(
            "/extractions/digitization/1/add_documents", headers=self.headers
        )
        # Assert
        self.assertEqual(503, response.status_code)

    def test_remove_document_from_digitization_list_permitted(self):
        # Arrange
        self.mockTestUser([ActionType.Extract])
        # Act
        response = self.client.put(
            "/extractions/digitization/1/remove_documents",
            headers=self.headers,
        )
        # Assert
        self.assertEqual(503, response.status_code)

    def test_delete_extraction(self):
        # Arrange
        self.mockTestUser([ActionType.Extract, ActionType.ReadDatatableAll])
        # Act
        response = self.client.delete(
            "/extractions/digitization/1",
            headers=self.headers,
        )
        # Assert
        self.assertEqual(404, response.status_code)
