import unittest

from predictions.dataset_generators import VolumesDatasetGenerator


class TestDatasetsGenerators(unittest.TestCase):
    def test_volumes_dataset_generator(self):
        generator = VolumesDatasetGenerator()
        generator.generate()
