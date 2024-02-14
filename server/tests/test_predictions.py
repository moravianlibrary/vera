import unittest


class TestPredictions(unittest.TestCase):
    def test_predict_items_pages(self):
        from predictions.volumes_pages_predictor import VolumesPagesPredictor
        predictor = VolumesPagesPredictor()
        predicted = predictor.predict(
            "test name",
            "1996",
            ["Moravska zemska knihovna"],
            ["Brno"],
            ["cze"],
            ["Deník"]
        )
        self.assertIsNotNone(predicted)
        self.assertIsInstance(predicted, float)
        print(predicted)
