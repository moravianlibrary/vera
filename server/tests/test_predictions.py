from unittest import TestCase
from unittest.mock import patch, Mock
from services.predictor import Predictor
from pymarc import MARCReader, Record
from services.predictor import PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD
from schemas import AlephRecord


def load_aleph_record(sysno: str) -> Record:
    with open(f"tests/aleph_records/{sysno}.marc", "rb") as f:
        return list(MARCReader(f))[0]


class TestPredictions(TestCase):
    @patch("requests.get")
    def test_predict_periodicals_page_count_success(self, mock_get):
        # Arrange
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD: 100
        }
        mock_get.return_value = mock_response

        sysno = "MZK01-000121929"
        aleph_record = AlephRecord(sysno, load_aleph_record(sysno))
        mock_aleph_issue = Mock()
        mock_aleph_issue.volume_year = "2024"

        predictor = Predictor(url="http://testurl.com")

        # Act
        page_count = predictor.predict_periodicals_page_count(
            aleph_record, mock_aleph_issue
        )

        # Assert
        self.assertEqual(page_count, 100)

    @patch("requests.get")
    def test_predict_periodicals_page_count_failure(self, mock_get):
        # Arrange
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"error": "Internal Server Error"}
        mock_get.return_value = mock_response

        mock_document = Mock()
        mock_document.sysno = "123"
        mock_document.volume_year = "2024"
        mock_document.volume = None
        mock_document.catalog_record = Mock()
        mock_document.catalog_record.main_record = load_aleph_record(
            "MZK01-000121929"
        )

        predictor = Predictor(url="http://testurl.com")

        # Assert
        with self.assertRaises(Exception):
            predictor.predict_periodicals_page_count(mock_document)

    def test_get_instance(self):
        with patch("config.VeraConfig.PredictorUrl", "http://testurl.com"):
            predictor = Predictor.get_instance()
            self.assertIsInstance(predictor, Predictor)
            self.assertEqual(predictor.url, "http://testurl.com")
