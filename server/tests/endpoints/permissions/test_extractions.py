from .base import TestEndpointsPermissionsBase
from datatypes import ActionType


class TestExtractionsEndpointsPermissions(TestEndpointsPermissionsBase):
    def test_create_extraction_permission(self):
        self.assertEndpointPermission(
            "POST",
            "/extractions/generated",
            ActionType.Extract,
            success_status_code=422,
        )

    def test_delete_extraction_permission(self):
        self.assertEndpointPermission(
            "DELETE",
            "/extractions/generated/1",
            ActionType.Extract,
            success_status_code=404,
        )

    def test_get_extraction_permission(self):
        self.assertEndpointPermission(
            "GET",
            "/extractions/generated/1",
            ActionType.Extract,
            success_status_code=404,
        )

    def test_get_extractions_permission(self):
        self.assertEndpointPermission(
            "GET",
            "/extractions/generated",
            ActionType.Extract,
        )
