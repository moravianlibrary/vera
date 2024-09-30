from .base import TestEndpointsPermissionsBase
from datatypes import ActionType


class TestCatalogRecordsEndpointsPermissions(TestEndpointsPermissionsBase):
    def test_get_catalog_records_permission(self):
        self.assertEndpointPermission(
            "POST",
            "/catalog_records/search",
            ActionType.ReadCatalogRecords,
            success_status_code=503,
        )

    def test_approve_catalog_record_difference_permission(self):
        self.assertEndpointPermission(
            "PATCH",
            "/catalog_records/differences/1/approve",
            ActionType.ReviewCatalogRecords,
            success_status_code=503,
        )
