import unittest
from tests.helper_funcs import mockClsEnv

from catalogs.enums import DigitizationState


class TestDigitizationRegister(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def test_get_state_by_barcode(self):
        from catalogs.digitization_registry.digitization_registry import (
            DigitizationRegistryClient,
        )

        self.assertEqual(
            DigitizationRegistryClient()
            .get_document(barcode="2619213824")
            .digitization_state,
            DigitizationState.Finished,
        )

        self.assertEqual(
            DigitizationRegistryClient()
            .get_document(barcode="2610280747")
            .digitization_state,
            DigitizationState.Finished,
        )

    def test_get_state_for_volume_by_cnb(self):
        from catalogs.digitization_registry.digitization_registry import (
            DigitizationRegistryClient,
        )

        self.assertEqual(
            DigitizationRegistryClient()
            .get_document(cnb="cnb002603627", volume="1")
            .digitization_state,
            DigitizationState.Finished,
        )

    def test_get_state_for_periodical_issues(self):
        from catalogs.digitization_registry.digitization_registry import (
            DigitizationRegistryClient,
        )

        self.assertEqual(
            DigitizationRegistryClient()
            .get_document(barcode="2610172122")
            .digitization_state,
            DigitizationState.Finished,
        )
        self.assertIsNone(
            DigitizationRegistryClient().get_document(
                barcode="2610312769",
                cnb="cnb001723088",
                isxn="9788073580742",
                volume="1, učebnice",
            )
        )
        self.assertEqual(
            DigitizationRegistryClient()
            .get_document(
                isxn="0139-505X", year="2021", volume="106", bundle="1-37"
            )
            .digitization_state,
            DigitizationState.Finished,
        )
        self.assertIsNone(
            DigitizationRegistryClient().get_document(
                isxn="0139-505X", year="2022", volume="107", bundle="33"
            )
        )
        self.assertIsNone(
            DigitizationRegistryClient().get_document(
                isxn="0139-505X", year="2021", volume="107", bundle="33"
            )
        )
        self.assertIsNone(
            DigitizationRegistryClient().get_document(
                isxn="0139-505X", year="2021", volume="106", bundle="33"
            )
        )
        self.assertEqual(
            DigitizationRegistryClient()
            .get_document(cnb="cnb000280880")
            .digitization_state,
            DigitizationState.Finished,
        )
