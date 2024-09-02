from .base import TestEndpointsBase
from models import CatalogRecord, Document, Intention, DigitizationList
from datatypes import DigitizationState, IssuanceType
from datetime import date, timedelta


TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"


class TestDigitizationListsEndpoints(TestEndpointsBase):
    def setUpTestDocuments(self):
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="MZK01-001343591",
                    marc=TEST_MARC_BYTES,
                    skc_marc=TEST_MARC_BYTES,
                    language="eng",
                ),
                CatalogRecord(
                    sysno="MZK01-000899949",
                    marc=TEST_MARC_BYTES,
                    skc_marc=TEST_MARC_BYTES,
                    language="eng",
                ),
                Document(
                    sysno="MZK01-001343591",
                    barcode="2610568734",
                    issuance_type=IssuanceType.Unit,
                    digitization_state=DigitizationState.NotDigitized,
                    pages_count_catalog=357,
                    added_by="test_user",
                ),
                Document(
                    sysno="MZK01-000899949",
                    barcode="2619253549",
                    issuance_type=IssuanceType.Unit,
                    digitization_state=DigitizationState.Finished,
                    pages_count_catalog=394,
                    added_by="test_user",
                ),
            ]
        )
        self.session.add(
            Intention(
                id=1,
                name="Intention 1",
                target_page_count=12000,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=30),
            )
        )
        self.session.flush()

    def test_create_extraction(self):
        # Arrange
        self.setUpTestDocuments()
        self.mockIndexerGetDocumentIds([1, 2])

        # Act
        response = self.client.post(
            "/extractions/digitization?intention_id=1",
            json={},
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(200, response.status_code)
        extraction = response.json()
        self.assertEqual(extraction["document_ids"], [1, 2])
        self.assertEqual(extraction["page_count"], 751)
        self.assertEqual(extraction["created_by"], "test_user")

    def test_create_extraction_fail_on_empty_list(self):
        # Arrange
        self.mockIndexerGetDocumentIds([])

        # Act
        response = self.client.post(
            "/extractions/digitization?intention_id=1",
            json={},
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(400, response.status_code)
        self.assertEqual(
            "Empty extraction can not be created", response.json()["detail"]
        )

    def test_create_extraction_fail_on_document_without_cnb(self):
        # Arrange
        self.setUpTestDocuments()
        catalog_record = CatalogRecord.get(self.session, "MZK01-000899949")
        catalog_record.language = "cze"
        catalog_record.save(self.session)
        self.session.flush()
        self.mockIndexerGetDocumentIds([1, 2])

        # Act
        response = self.client.post(
            "/extractions/digitization?intention_id=1",
            json={},
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(400, response.status_code)
        self.assertEqual(
            "Document with invalid CNB cannot be extracted",
            response.json()["detail"],
        )

    def test_create_extraction_fail_on_already_extracted(self):
        # Arrange
        self.setUpTestDocuments()
        self.session.add(
            DigitizationList(intention_id=1, created_by="test_user")
        )
        document = Document.get(self.session, 1)
        document.digitization_list_id = 1
        document.save(self.session)
        self.session.flush()
        self.mockIndexerGetDocumentIds([1, 2])

        # Act
        response = self.client.post(
            "/extractions/digitization?intention_id=1",
            json={},
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(409, response.status_code)
        self.assertEqual(
            "Document has been already extracted",
            response.json()["detail"],
        )

    def test_create_extraction_fail_on_document_without_page_count(
        self,
    ):
        # Arrange
        self.setUpTestDocuments()
        document = Document.get(self.session, 1)
        document.pages_count_catalog = 0
        document.save(self.session)
        self.session.flush()
        self.mockIndexerGetDocumentIds([1, 2])

        # Act
        response = self.client.post(
            "/extractions/digitization?intention_id=1",
            json={},
            headers=self.json_headers,
        )

        # Assert
        self.assertEqual(400, response.status_code)
        self.assertEqual(
            "Document without page count cannot be extracted",
            response.json()["detail"],
        )

    # TODO: fix tests from this one to the bottom
    def test_get_extractions(self):
        # Act
        response = self.client.get(
            "/extractions/digitization",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
        extractions = response.json()["items"]
        self.assertEqual(len(extractions), 1)
        self.assertEqual(extractions[0]["document_ids"], [1001])
        self.assertEqual(extractions[0]["extracted_pages"], 1000)

    def test_get_extraction(self):
        # Act
        response = self.client.get(
            "/extractions/digitization/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
        extraction = response.json()
        self.assertEqual(extraction["document_ids"], [1001])
        self.assertEqual(extraction["extracted_pages"], 1000)

    def test_add_documents_to_extraction(self):
        # Arrange
        query = {
            "query": {
                "bool": {"must": {"terms": {"id": [1, 2]}}},
            },
            "size": 5,
        }

        # Act
        response = self.client.put(
            "/extractions/digitization/1/add_documents",
            json=query,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
        extraction = response.json()
        self.assertEqual(extraction["document_ids"], [1001, 1, 2])
        self.assertEqual(extraction["extracted_pages"], 1751)

    def test_remove_document_to_extraction(self):
        # Arrange
        query_add = {
            "query": {
                "bool": {"must": {"terms": {"id": [1, 2]}}},
            },
            "size": 5,
        }
        query_remove = {
            "query": {
                "bool": {"must": {"terms": {"id": [1001]}}},
            },
            "size": 5,
        }

        # Act
        response_add = self.client.put(
            "/extractions/digitization/1/add_documents",
            json=query_add,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        response_remove = self.client.put(
            "/extractions/digitization/1/remove_documents",
            json=query_remove,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response_add.status_code)
        self.assertEqual(200, response_remove.status_code)
        extraction = response_remove.json()
        self.assertEqual(extraction["document_ids"], [1, 2])
        self.assertEqual(extraction["extracted_pages"], 751)

    def test_remove_document_to_extraction_run_on_empty_list(self):
        # Arrange
        query = {
            "query": {
                "bool": {"must": {"terms": {"id": [1002]}}},
            },
            "size": 5,
        }

        # Act
        response = self.client.put(
            "/extractions/digitization/1/remove_documents",
            json=query,
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)

    def test_delete_extraction(self):
        # Act
        response = self.client.delete(
            "/extractions/digitization/1",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )
        response_document = self.client.get(
            "/documents/1001",
            headers={
                "Authorization": "Bearer test_token",
                "Content-Type": "application/json",
            },
        )

        # Assert
        self.assertEqual(200, response.status_code)
        self.assertIsNone(response_document.json()["digitization_list_id"])
