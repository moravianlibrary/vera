from .base import TestEndpointsPermissionsBase
from datatypes import ActionType


class TestDigitizationListsIntegration(TestEndpointsPermissionsBase):
    def test_create_extraction_permission(self):
        self.assertEndpointPermission(
            "POST",
            "/extractions/digitization?intention_id=1",
            ActionType.Extract,
            success_status_code=503,
        )

    def test_get_extractions_permission(self):
        self.assertEndpointPermission(
            "GET",
            "/extractions/digitization?intention_id=1",
            ActionType.Extract,
        )

    def test_get_extraction_permission(self):
        self.assertEndpointPermission(
            "GET",
            "/extractions/digitization/1",
            ActionType.Extract,
            success_status_code=404,
        )

    def test_add_documents_to_digitization_list_permission(self):
        self.assertEndpointPermission(
            "PUT",
            "/extractions/digitization/1/add_documents",
            ActionType.Extract,
            success_status_code=503,
        )

    def test_remove_document_from_digitization_list_permission(self):
        self.assertEndpointPermission(
            "PUT",
            "/extractions/digitization/1/remove_documents",
            ActionType.Extract,
            success_status_code=503,
        )

    def test_delete_extraction(self):
        self.assertEndpointPermission(
            "DELETE",
            "/extractions/digitization/1",
            ActionType.Extract,
            success_status_code=404,
        )
