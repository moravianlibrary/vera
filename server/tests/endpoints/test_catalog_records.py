from .base import TestEndpointsBase
from unittest.mock import Mock, patch
from datatypes import ActionType, CatalogSource, MarcFieldDifferenceType
from models import (
    CatalogRecord,
    CatalogRecordFieldDifference,
    CatalogRecordSubfieldDifference,
)


class TestCatalogRecordsEndpoints(TestEndpointsBase):
    def setUp(self):
        super().setUp()
        self.marc_bytes = (
            b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"
        )

    @patch(
        "schemas.index_catalog_record.IndexCatalogRecord.search",
    )
    def test_get_catalog_records(self, mock_search: Mock):
        # Arrange
        self.mockIndexer()
        mock_search.return_value = {
            "num_found": 2,
            "items": [
                {
                    "sysno": "MZK01-123456789",
                    "main_record": {"fields": [{"001": "000121929"}]},
                    "has_valid_main_record": False,
                    "has_valid_cnb": False,
                },
                {
                    "sysno": "MZK01-987654321",
                    "main_record": {"fields": [{"001": "000121929"}]},
                    "has_valid_main_record": False,
                    "has_valid_cnb": False,
                },
            ],
        }
        self.session.add_all(
            [
                CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
                CatalogRecord(sysno="MZK01-987654321", marc=self.marc_bytes),
            ]
        )
        self.session.flush()
        self.mockTestUser([ActionType.ReadCatalogRecords])

        # Act
        response = self.client.post(
            "/catalog_records/search",
            json={"query": {"match_all": {}}},
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
        self.assertFalse(record1["has_valid_main_record"])
        self.assertFalse(record1["has_valid_cnb"])

        record2 = response.json()["items"][1]
        self.assertEqual(record2["sysno"], "MZK01-987654321")
        self.assertEqual(
            record2["main_record"]["fields"], [{"001": "000121929"}]
        )
        self.assertFalse(record1["has_valid_main_record"])
        self.assertFalse(record1["has_valid_cnb"])

    def test_get_catalog_record_by_sysno(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
            ]
        )
        self.session.flush()
        self.mockTestUser([ActionType.ReadCatalogRecords])

        # Act
        response = self.client.get(
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
        self.session.add_all(
            [
                CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
            ]
        )
        self.session.flush()
        self.mockTestUser([ActionType.ReadCatalogRecords])

        # Act
        response = self.client.get(
            "/catalog_records/MZK01-12345678",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 404)

    def test_get_skc_difference(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="MZK01-123456789",
                    marc=self.marc_bytes,
                    skc_marc=self.marc_bytes,
                ),
            ]
        )
        self.session.flush()
        self.mockTestUser([ActionType.ReadCatalogRecords])

        # Act
        response = self.client.get(
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
        self.session.add_all(
            [
                CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
            ]
        )
        self.session.flush()
        self.mockTestUser([ActionType.ReadCatalogRecords])

        # Act
        response = self.client.get(
            "/catalog_records/MZK01-123456789/differences/SKC",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_get_record_with_cnb_difference(self):
        # Arrange
        self.session.add(
            CatalogRecord(
                sysno="MZK01-123456789",
                marc=self.marc_bytes,
                cnb_marc=self.marc_bytes,
            )
        )
        self.session.flush()
        self.session.add(
            CatalogRecordFieldDifference(
                sysno="MZK01-123456789",
                source=CatalogSource.CNB,
                tag="001",
                difference_type=MarcFieldDifferenceType.Equal,
                deleted=False,
            )
        )
        self.session.flush()
        self.session.add(
            CatalogRecordSubfieldDifference(
                field_difference_id=1,
                value="000121929",
                different_to="000121929",
                differs=False,
            )
        )
        self.session.flush()
        self.mockTestUser([ActionType.ReadCatalogRecords])
        self.maxDiff = None

        # Act
        response = self.client.get(
            "/catalog_records/MZK01-123456789",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "cnb": None,
                "cnb_difference": [
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
                "cnb_record": {
                    "fields": [{"001": "000121929"}],
                    "leader": "00048    a2200037   4500",
                },
                "cnb_sysno": None,
                "has_valid_cnb": False,
                "has_valid_main_record": False,
                "isxn": None,
                "language": "cze",
                "added_at": response.json()["added_at"],
                "updated_at": response.json()["updated_at"],
                "main_record": {
                    "fields": [{"001": "000121929"}],
                    "leader": "00048    a2200037   4500",
                },
                "signature": None,
                "skc_difference": [],
                "skc_record": None,
                "skc_sysno": None,
                "sysno": "MZK01-123456789",
            },
        )

    # TODO: fix this test so it tests the CNB difference for search result
    def test_get_records_page_with_cnb_difference(self):
        # Arrange
        self.session.add(
            CatalogRecord(
                sysno="MZK01-123456789",
                marc=self.marc_bytes,
                cnb_marc=self.marc_bytes,
            )
        )
        self.session.flush()
        self.session.add(
            CatalogRecordFieldDifference(
                sysno="MZK01-123456789",
                source=CatalogSource.CNB,
                tag="001",
                difference_type=MarcFieldDifferenceType.Equal,
                deleted=False,
            )
        )
        self.session.flush()
        self.session.add(
            CatalogRecordSubfieldDifference(
                field_difference_id=1,
                value="000121929",
                different_to="000121929",
                differs=False,
            )
        )
        self.session.flush()
        self.mockTestUser([ActionType.ReadCatalogRecords])

        # Act
        response = self.client.get(
            "/catalog_records/MZK01-123456789",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "cnb": None,
                "cnb_difference": [
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
                "cnb_record": {
                    "fields": [{"001": "000121929"}],
                    "leader": "00048    a2200037   4500",
                },
                "cnb_sysno": None,
                "has_valid_cnb": False,
                "has_valid_main_record": False,
                "isxn": None,
                "language": "cze",
                "added_at": response.json()["added_at"],
                "updated_at": response.json()["updated_at"],
                "main_record": {
                    "fields": [{"001": "000121929"}],
                    "leader": "00048    a2200037   4500",
                },
                "signature": None,
                "skc_difference": [],
                "skc_record": None,
                "skc_sysno": None,
                "sysno": "MZK01-123456789",
            },
        )

    def test_get_cnb_difference(self):
        # Arrange
        self.session.add_all(
            [
                CatalogRecord(
                    sysno="MZK01-123456789",
                    marc=self.marc_bytes,
                    cnb_marc=self.marc_bytes,
                ),
            ]
        )
        self.session.flush()
        self.mockTestUser([ActionType.ReadCatalogRecords])

        # Act
        response = self.client.get(
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
        self.session.add_all(
            [
                CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
            ]
        )
        self.session.flush()
        self.mockTestUser([ActionType.ReadCatalogRecords])

        # Act
        response = self.client.get(
            "/catalog_records/MZK01-123456789/differences/CNB",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_approve_difference(self):
        # Arrange
        self.session.add(
            CatalogRecord(sysno="MZK01-123456789", marc=self.marc_bytes),
        )
        self.session.flush()
        self.session.add(
            CatalogRecordFieldDifference(
                sysno="MZK01-123456789",
                source=CatalogSource.CNB,
                tag="001",
                difference_type=MarcFieldDifferenceType.Equal,
                deleted=False,
            )
        )
        self.session.flush()
        self.mockTestUser([ActionType.ReviewCatalogRecords])

        # Act
        response = self.client.patch(
            "/catalog_records/differences/1/approve",
            headers={
                "Authorization": "Bearer test_token",
            },
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["cnb_difference"][0]["approved_by"], "test_user"
        )
