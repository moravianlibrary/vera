import unittest
from tests.helper_funcs import mockClsEnv

from catalogs.digitization_registry.digitization_registry import (
    DigitizationRegistry,
)
import pandas as pd


class TestAlephCatalog(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mockClsEnv(cls)

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def test_from_csv(self):
        pass
        # csv_file_path = "/tmp/documents.csv"

        # df = pd.read_csv(csv_file_path, encoding="latin1")

        # for index, row in df.iterrows():
        #     df.at[index, "digitization_state"] = DigitizationRegistry(
        #         row["barcode"],
        #         row["cnb"],
        #         row["isbn_issn"],
        #         row["year"],
        #         row["volume"],
        #         row["bundle"],
        #     )

        # df.to_csv("/tmp/documents_digitization_state.csv", index=False)
