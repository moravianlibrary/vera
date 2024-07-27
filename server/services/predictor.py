import requests
from typing import Optional
from config import VeraConfig
from models import Document
from services.external.aleph import AlephRecord
from services.parsers.frequency_parser import parse_year, parse_frequency


PREDICT_PERIODICAL_PAGE_COUNT_ENDPOINT = "/predict_periodical_page_count"


class Predictor:
    def __init__(self, url, timeout: int = 30):
        self.url = url
        self.timeout = timeout

    def predict_periodical_page_count(
        self, document: Document
    ) -> Optional[int]:
        aleph_record = AlephRecord(
            document.sysno, document.catalog_record.main_record
        )
        body = {
            "title": aleph_record.title,
            "year": parse_year(document.volume_year or document.volume),
            "frequency": parse_frequency(
                document.volume_year or document.volume,
                aleph_record.frequencies,
            ),
            "publisher": aleph_record.publisher,
            "language": aleph_record.languages[0],
            "region": aleph_record.publishing_place,
            "keywords": aleph_record.keywords,
        }
        response = requests.get(
            f"{self.url}/{PREDICT_PERIODICAL_PAGE_COUNT_ENDPOINT}", json=body
        )
        return response["page_count"] if response.status_code == 200 else None

    @staticmethod
    def get_instance():
        return Predictor(VeraConfig.PredictorUrl)
