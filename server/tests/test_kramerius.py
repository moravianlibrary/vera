import unittest


class TestPredictions(unittest.TestCase):
    def test_find_missing_volumes(self):
        from kramerius.find_missing_volumes import (
            find_missing_periodical_volumes,
        )

        # with open("/tmp/test_missing_volumes.csv", "w") as file:
        #     find_missing_periodical_volumes(file)
