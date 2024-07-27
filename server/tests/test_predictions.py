# import unittest
# from services.predictor import Predictor
# from models import Document


# class TestPredictions(unittest.TestCase):
#     def test_predict_volume_pages(self):
#         # Arrange
#         predictor = Predictor()

#         # Act
#         predicted = predictor.predict_periodical_page_count(
#             "test name",
#             1996,
#             365,
#             "Moravska zemska knihovna",
#             "Brno",
#             "cze",
#         )

#         # Assert
#         self.assertIsNotNone(predicted)
#         self.assertIsInstance(predicted, int)

#     def test_predict_volume_pages_2(self):
#         from schemas import Frequency
#         from services.predictions.frequency_parser import (
#             parse_frequency,
#             parse_year,
#         )
#         from services.predictions.volumes_pages_predictor import (
#             VolumesPagesPredictor,
#         )

#         title = "Svobodné slovo : list Československé strany socialistické."
#         year = "1952"
#         publisher = "Československá strana socialistická,"
#         publishing_place = "Praha :"
#         language = "cze"
#         frequencies = [{"frequency": "Deník"}]

#         predictor = VolumesPagesPredictor()
#         predicted = predictor.predict(
#             name=title,
#             year=parse_year(year),
#             publisher=publisher,
#             origin=publishing_place,
#             language=language,
#             frequency=parse_frequency(
#                 year,
#                 [Frequency(**freq) for freq in frequencies],
#             ),
#         )
#         self.assertIsNotNone(predicted)
#         self.assertIsInstance(predicted, float)

#     def test_predict_volume_pages_3(self):
#         title = "Bílé Karpaty : časopis moravsko-slovenského pomezí"
#         year = "2021"
#         publisher = (
#             "Společnost pro trvale udržitelný život, regionální "
#             "pobočka Bílé Karpaty ;"
#         )
#         publishing_place = "Uherské Hradiště :"
#         language = "cze"
#         frequencies = [
#             {"frequency": "2x ročně", "date": "2006-"},
#             {"frequency": "4x ročně", "date": "1994-2005"},
#         ]

#         predictor = VolumesPagesPredictor()
#         predicted = predictor.predict(
#             name=title,
#             year=parse_year(year),
#             publisher=publisher,
#             origin=publishing_place,
#             language=language,
#             frequency=parse_frequency(
#                 year,
#                 [Frequency(**freq) for freq in frequencies],
#             ),
#         )
#         self.assertIsNotNone(predicted)
#         self.assertIsInstance(predicted, float)
