from .base import TestEndpointsPermissionsBase
from datatypes import ActionType, DigitizationState
from models import CatalogRecord, Category, Document, Department, User


class TestDocumentsIntegration(TestEndpointsPermissionsBase):
    def setUp(self):
        super().setUp()

        self.session.add_all(
            [
                CatalogRecord(sysno="test_sysno", marc=b"a"),
                Category(name="test"),
                Department(name="test_department_1", abbreviation="TST-1"),
                Department(name="test_department_2 ", abbreviation="TST-2"),
            ]
        )
        self.session.flush()
        self.session.add_all(
            [
                Document(
                    sysno="test_sysno",
                    category_id=1,
                    added_by="test_user",
                    digitization_state=DigitizationState.NotDigitized,
                ),
                User(username="test_user", department_id=1),
                User(username="same_department_user", department_id=1),
                User(username="other_department_user", department_id=2),
            ]
        )
        self.session.flush()

    def test_add_document_from_catalog_permission(self):
        self.assertEndpointPermission(
            "POST",
            "documents/from_catalog",
            ActionType.InsertDatatable,
            success_status_code=422,
        )

    def test_update_document_edit_all_permission(self):
        # Arrange
        document = Document.get(self.session, 1)
        document.added_by = "other_department_user"
        document.save(self.session)

        # Act and Assert
        self.assertEndpointPermission(
            "PUT",
            "documents/1",
            ActionType.EditDatatableAll,
        )

    def test_update_document_edit_departments_permission(self):
        # Arrange
        document = Document.get(self.session, 1)
        document.added_by = "same_department_user"
        document.save(self.session)

        # Act and Assert
        self.assertEndpointPermitted(
            "PUT",
            "documents/1",
            ActionType.EditDatatableDepartment,
        )
        self.assertEndpointProhited(
            "PUT",
            "documents/1",
            [ActionType.EditDatatableAll, ActionType.EditDatatableDepartment],
        )

    def test_update_document_edit_own_permission(self):
        self.assertEndpointPermitted(
            "PUT",
            "documents/1",
            ActionType.EditDatatableOwn,
        )
        self.assertEndpointProhited(
            "PUT",
            "documents/1",
            [
                ActionType.EditDatatableAll,
                ActionType.EditDatatableDepartment,
                ActionType.EditDatatableOwn,
            ],
        )

    def test_delete_document_edit_all_permission(self):
        # Arrange
        document = Document.get(self.session, 1)
        document.added_by = "other_department_user"
        document.save(self.session)

        # Act and Assert
        self.assertEndpointPermission(
            "DELETE",
            "documents/1",
            ActionType.EditDatatableAll,
        )

    def test_delete_document_edit_departments_permission(self):
        # Arrange
        document = Document.get(self.session, 1)
        document.added_by = "same_department_user"
        document.save(self.session)

        # Act and Assert
        self.assertEndpointProhited(
            "DELETE",
            "documents/1",
            [ActionType.EditDatatableAll, ActionType.EditDatatableDepartment],
        )
        self.assertEndpointPermitted(
            "DELETE",
            "documents/1",
            ActionType.EditDatatableDepartment,
        )

    def test_delete_document_edit_own_permission(self):
        self.assertEndpointProhited(
            "DELETE",
            "documents/1",
            [
                ActionType.EditDatatableAll,
                ActionType.EditDatatableDepartment,
                ActionType.EditDatatableOwn,
            ],
        )
        self.assertEndpointPermitted(
            "DELETE",
            "documents/1",
            ActionType.EditDatatableOwn,
        )

    def test_get_document_read_all_permission(self):
        # Arrange
        document = Document.get(self.session, 1)
        document.added_by = "other_department_user"
        document.save(self.session)

        # Act and Assert
        self.assertEndpointPermission(
            "GET",
            "documents/1",
            ActionType.ReadDatatableAll,
        )

    def test_get_document_read_departments_permission(self):
        # Arrange
        document = Document.get(self.session, 1)
        document.added_by = "same_department_user"
        document.save(self.session)

        # Act and Assert
        self.assertEndpointProhited(
            "GET",
            "documents/1",
            [ActionType.ReadDatatableAll, ActionType.ReadDatatableDepartment],
        )
        self.assertEndpointPermitted(
            "GET",
            "documents/1",
            ActionType.ReadDatatableDepartment,
        )

    def test_get_document_read_own_permission(self):
        self.assertEndpointProhited(
            "GET",
            "documents/1",
            [
                ActionType.ReadDatatableAll,
                ActionType.ReadDatatableDepartment,
                ActionType.ReadDatatableOwn,
            ],
        )
        self.assertEndpointPermitted(
            "GET",
            "documents/1",
            ActionType.ReadDatatableOwn,
        )

    def test_query_documents_permission(self):
        self.assertEndpointPermitted(
            "POST",
            "documents/query",
            ActionType.ReadDatatableAll,
            expected_status_code=422,
        )
        self.assertEndpointPermitted(
            "POST",
            "documents/query",
            ActionType.ReadDatatableDepartment,
            expected_status_code=422,
        )
        self.assertEndpointPermitted(
            "POST",
            "documents/query",
            ActionType.ReadDatatableOwn,
            expected_status_code=422,
        )
        self.assertEndpointProhited(
            "POST",
            "documents/query",
            [
                ActionType.ReadDatatableAll,
                ActionType.ReadDatatableDepartment,
                ActionType.ReadDatatableOwn,
            ],
        )

    def test_export_query_documents_permission(self):
        self.assertEndpointPermitted(
            "POST",
            "documents/query/export",
            ActionType.ReadDatatableAll,
            expected_status_code=422,
        )
        self.assertEndpointPermitted(
            "POST",
            "documents/query/export",
            ActionType.ReadDatatableDepartment,
            expected_status_code=422,
        )
        self.assertEndpointPermitted(
            "POST",
            "documents/query/export",
            ActionType.ReadDatatableOwn,
            expected_status_code=422,
        )
        self.assertEndpointProhited(
            "POST",
            "documents/query/export",
            [
                ActionType.ReadDatatableAll,
                ActionType.ReadDatatableDepartment,
                ActionType.ReadDatatableOwn,
            ],
        )

    def test_change_category_for_query_documents_permission(self):
        self.assertEndpointPermitted(
            "PUT",
            "documents/query/change_category",
            ActionType.EditDatatableAll,
            expected_status_code=422,
        )
        self.assertEndpointPermitted(
            "PUT",
            "documents/query/change_category",
            ActionType.EditDatatableDepartment,
            expected_status_code=422,
        )
        self.assertEndpointPermitted(
            "PUT",
            "documents/query/change_category",
            ActionType.EditDatatableOwn,
            expected_status_code=422,
        )
        self.assertEndpointProhited(
            "PUT",
            "documents/query/change_category",
            [
                ActionType.EditDatatableAll,
                ActionType.EditDatatableDepartment,
                ActionType.EditDatatableOwn,
            ],
        )

    def test_delete_query_documents_permission(self):
        self.assertEndpointPermitted(
            "POST",
            "documents/query/delete",
            ActionType.EditDatatableAll,
            expected_status_code=422,
        )
        self.assertEndpointPermitted(
            "POST",
            "documents/query/delete",
            ActionType.EditDatatableDepartment,
            expected_status_code=422,
        )
        self.assertEndpointPermitted(
            "POST",
            "documents/query/delete",
            ActionType.EditDatatableOwn,
            expected_status_code=422,
        )
        self.assertEndpointProhited(
            "POST",
            "documents/query/delete",
            [
                ActionType.EditDatatableAll,
                ActionType.EditDatatableDepartment,
                ActionType.EditDatatableOwn,
            ],
        )
