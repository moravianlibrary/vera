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
            DigitizationRegistry,
        )

        self.assertEqual(
            DigitizationRegistry(barcode="2619213824"),
            DigitizationState.Finished,
        )

        self.assertEqual(
            DigitizationRegistry(barcode="2610280747"),
            DigitizationState.Finished,
        )

    def test_get_state_for_volume_by_cnb(self):
        from catalogs.digitization_registry.digitization_registry import (
            DigitizationRegistry,
        )

        self.assertEqual(
            DigitizationRegistry(cnb="cnb002603627", volume="1"),
            DigitizationState.Revision,
        )

    def test_get_state_for_periodical_issues(self):
        from catalogs.digitization_registry.digitization_registry import (
            DigitizationRegistry,
        )

        self.assertEqual(
            DigitizationRegistry(barcode="2610172122"),
            DigitizationState.Finished,
        )
        self.assertEqual(
            DigitizationRegistry(
                barcode="2610312769",
                cnb="cnb001723088",
                isxn="9788073580742",
                volume="1, učebnice",
            ),
            DigitizationState.NotDigitized,
        )
        self.assertEqual(
            DigitizationRegistry(
                isxn="0139-505X", year="2021", volume="106", bundle="1-37"
            ),
            DigitizationState.Finished,
        )
        self.assertEqual(
            DigitizationRegistry(
                isxn="0139-505X", year="2022", volume="107", bundle="33"
            ),
            DigitizationState.NotDigitized,
        )
        self.assertEqual(
            DigitizationRegistry(
                isxn="0139-505X", year="2021", volume="107", bundle="33"
            ),
            DigitizationState.NotDigitized,
        )
        self.assertEqual(
            DigitizationRegistry(
                isxn="0139-505X", year="2021", volume="106", bundle="33"
            ),
            DigitizationState.NotDigitized,
        )
        self.assertEqual(
            DigitizationRegistry(cnb="cnb000280880"),
            DigitizationState.Finished,
        )
