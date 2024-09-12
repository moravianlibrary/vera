from .base import TestEndpointsBase
from models import Intention, Category, Distribution
from datetime import date, timedelta


class TestExtractionsEndpoints(TestEndpointsBase):
    def test_create_extraction(self):
        # Arrange
        self.session.add(
            Intention(
                name="Test Intention",
                target_page_count=10,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=1),
            )
        )
        self.session.flush()
        self.session.add(Category(name="Test Category", assignable=True))
        self.session.flush()
        self.session.add(
            Distribution(intention_id=1, category_id=1, percentage=100)
        )
        self.session.flush()
        self.mockDocuments({"category_id": [1], "pages_count_catalog": [10]})
        settings = {"target_pages": 10}

        # Act
        response = self.client.post(
            "/extractions/generated", json=settings, headers=self.json_headers
        )

        # Assert
        self.assertResponse(response, 200)
        body = response.json()
        self.assertEqual(body["document_ids"], [1])
        self.assertEqual(body["selected_pages"], 10)
        self.assertEqual(body["generated_by"], "test_user")

    def test_create_extraction_fail_on_empty_target_pages(self):
        # Arrange
        settings = {"target_pages": 0}

        # Act
        response = self.client.post(
            "/extractions/generated", json=settings, headers=self.json_headers
        )

        # Assert
        self.assertResponse(
            response, 400, "Empty extraction can not be created"
        )
