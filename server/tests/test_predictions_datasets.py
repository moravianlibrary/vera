import unittest

from predictions.dataset_generators import (
    VolumesDatasetGenerator,
)
from services.csv_writer import CsvWriter


class TestDatasetsGenerators(unittest.TestCase):
    def test_volumes_dataset_generator(self):
        # pass
        csv_writer = CsvWriter(1)
        generator = VolumesDatasetGenerator(csv_writer)
        generator.generate()
        with open("/tmp/volumes_dataset.csv", "w") as output_file:
            output_file.writelines(csv_writer._convert_to_csv_text())
