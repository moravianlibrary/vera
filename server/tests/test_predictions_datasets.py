import unittest

from predictions.dataset_generators import ItemsDatasetGenerator
from services.csv_writer import CsvWriter


class TestDatasetsGenerators(unittest.TestCase):
    def test_volumes_dataset_generator(self):
        csv_writer = CsvWriter(1)
        generator = ItemsDatasetGenerator(csv_writer)
        generator.generate()
        print(csv_writer.lines)
