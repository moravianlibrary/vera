from .base import TestEndpointsBase
from models import Extraction, Intention, CatalogRecord, Document
from datatypes import ActionType
from datetime import date, timedelta


class TestExtractionsEndpoints(TestEndpointsBase):
    def test_create_extraction(self):
        # Arrange
        self.session.add_all(
            [
                Intention(
                    name="Test Intention",
                    target_page_count=10,
                    start_date=date.today(),
                    end_date=date.today() + timedelta(days=1),
                ),
                CatalogRecord(sysno="Test Sysno", marc=b"Test MARC"),
            ]
        )
        self.session.flush()
        self.session.add(Document(sysno="Test Sysno", pages_count_catalog=10))
        settings = {"target_pages": 10}

        # Act
        response = self.client.post(
            "/extractions/generated", json=settings, headers=self.json_headers
        )

        # Assert
        print(response.json())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], role["name"])
        self.assertEqual(response.json()["actions"], role["actions"])
    
