import unittest


class TestPredictions(unittest.TestCase):
    def test_predict_items_pages(self):
        from predictions.predict_items_pages import ItemsPagesPredictor
        predictor = ItemsPagesPredictor()
        predicted = predictor.predict(
            "test name",
            1996,
            10,
            "Moravska zemska knihovna"
        )
        self.assertIsNotNone(predicted)
        self.assertIsInstance(predicted, float)
