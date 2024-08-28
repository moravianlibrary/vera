from tests.test_integration import TestIntegration
from helper_funcs import (
    createTestClient,
    createTestUser,
    mockUser,
    mock_db,
    get_all_actions_except,
)

from datatypes import ActionType
from models import CatalogRecord


class TestCatalogRecordsEndpointsPermissions(TestIntegration):
    def test_get_catalog_records_permitted(self):
        # Arange
        mock_db()
        mockUser(createTestUser(actions=[ActionType.ReadCatalogRecords]))

        # Act
        response = self.client.get(
            "/catalog_records", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 200)

    def test_get_catalog_records_prohibited(self):
        # Arange
        mock_db()
        mockUser(
            createTestUser(
                actions=get_all_actions_except([ActionType.ReadCatalogRecords])
            )
        )

        # Act
        response = self.client.get(
            "/catalog_records", headers={"Authorization": "Bearer test_token"}
        )

        # Assert
        self.assertEqual(response.status_code, 403)

    def test_approve_catalog_record_difference_permitted(self):
        # Arange
        mock_db()
        mockUser(createTestUser(actions=[ActionType.ReviewCatalogRecords]))

        # Act
        response = self.client.patch(
            "/catalog_records/differences/1/approve",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json()["detail"],
            "CatalogRecordFieldDifference with id 1 not found",
        )

    def test_approve_catalog_record_difference_prohibited(self):
        # Arange
        mock_db()
        mockUser(
            createTestUser(
                actions=get_all_actions_except(
                    [ActionType.ReviewCatalogRecords]
                )
            )
        )

        # Act
        response = self.client.patch(
            "/catalog_records/differences/1/approve",
            headers={"Authorization": "Bearer test_token"},
        )

        # Assert
        self.assertEqual(response.status_code, 403)


class TestCatalogRecordsIntegration(TestIntegration):
    def setUp(self):
        super().setUp()
        self.marc_bytes = (
            b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"
        )

    def test_get_catalog_records(self):
        # Arrange
        mock_db(
            [
                CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
                CatalogRecord(sysno="MZK01-987654321", marc=self.marc_bytes),
            ]
        )
        mockUser(createTestUser([ActionType.ReadCatalogRecords]))

        # Act
        client = createTestClient()
        response = client.get(
            "/catalog_records",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["num_found"], 2)

        record1 = response.json()["items"][0]
        self.assertEqual(record1["sysno"], "MZK01-123456789")
        self.assertEqual(
            record1["main_record"]["fields"], [{"001": "000121929"}]
        )
        self.assertTrue(record1["has_valid_main_record"])
        self.assertFalse(record1["has_valid_cnb"])

        record2 = response.json()["items"][1]
        self.assertEqual(record2["sysno"], "MZK01-987654321")
        self.assertEqual(
            record2["main_record"]["fields"], [{"001": "000121929"}]
        )
        self.assertTrue(record1["has_valid_main_record"])
        self.assertFalse(record1["has_valid_cnb"])

    def test_get_catalog_record_by_sysno(self):
        # Arrange
        mock_db(
            [
                CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
            ]
        )
        mockUser(createTestUser([ActionType.ReadCatalogRecords]))

        # Act
        client = createTestClient()
        response = client.get(
            "/catalog_records/MZK01-123456789",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        record = response.json()
        self.assertEqual(record["sysno"], "MZK01-123456789")
        self.assertEqual(
            record["main_record"]["fields"], [{"001": "000121929"}]
        )

    def test_get_catalog_record_by_sysno_invalid_sysno(self):
        # Arrange
        mock_db(
            [
                CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
            ]
        )
        mockUser(createTestUser([ActionType.ReadCatalogRecords]))

        # Act
        client = createTestClient()
        response = client.get(
            "/catalog_records/MZK01-12345678",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 404)

    def test_get_skc_difference(self):
        # Arrange
        mock_db(
            [
                CatalogRecord(
                    sysno="MZK01-123456789",
                    marc=self.marc_bytes,
                    skc_marc=self.marc_bytes,
                ),
            ]
        )
        mockUser(createTestUser([ActionType.ReadCatalogRecords]))

        # Act
        client = createTestClient()
        response = client.get(
            "/catalog_records/MZK01-123456789/differences/SKC",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            [
                {
                    "tag": "001",
                    "indicator1": None,
                    "indicator2": None,
                    "difference_type": "Equal",
                    "subfield_differences": [
                        {
                            "code": None,
                            "value": "000121929",
                            "different_to": "000121929",
                            "differs": False,
                        }
                    ],
                    "control_field": True,
                }
            ],
        )

    def test_get_skc_difference_without_skc_marc(self):
        # Arrange
        mock_db(
            [
                CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
            ]
        )
        mockUser(createTestUser([ActionType.ReadCatalogRecords]))

        # Act
        client = createTestClient()
        response = client.get(
            "/catalog_records/MZK01-123456789/differences/SKC",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_get_cnb_difference(self):
        # Arrange
        mock_db(
            [
                CatalogRecord(
                    sysno="MZK01-123456789",
                    marc=self.marc_bytes,
                    cnb_marc=self.marc_bytes,
                ),
            ]
        )
        mockUser(createTestUser([ActionType.ReadCatalogRecords]))

        # Act
        client = createTestClient()
        response = client.get(
            "/catalog_records/MZK01-123456789/differences/CNB",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            [
                {
                    "tag": "001",
                    "indicator1": None,
                    "indicator2": None,
                    "difference_type": "Equal",
                    "subfield_differences": [
                        {
                            "code": None,
                            "value": "000121929",
                            "different_to": "000121929",
                            "differs": False,
                        }
                    ],
                    "control_field": True,
                }
            ],
        )

    def test_get_cnb_difference_without_cnb_marc(self):
        # Arrange
        mock_db(
            [
                CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
            ]
        )
        mockUser(createTestUser([ActionType.ReadCatalogRecords]))

        # Act
        client = createTestClient()
        response = client.get(
            "/catalog_records/MZK01-123456789/differences/CNB",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 400)
