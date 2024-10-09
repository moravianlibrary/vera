import requests
from typing import Optional
from config import VeraConfig
from schemas import PredictPeriodicalsPageCount
from services.external.aleph import AlephRecord, AlephIssue
from services.parsers.frequency_parser import parse_year, parse_frequency
from datatypes import MaterialType


PREDICT_PERIODICAL_PAGE_COUNT_ENDPOINT = "/predict_periodicals_page_count"
PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD = "predicted_pages_count"


class Predictor:
    def __init__(self, url, timeout: int = 30):
        self.url = url
        self.timeout = timeout

    def predict_page_count(
        self, aleph_record: AlephRecord, aleph_issue: AlephIssue
    ):
        return (
            self.predict_periodicals_page_count(aleph_record, aleph_issue)
            if aleph_record.material_type == MaterialType.ContinuingResource
            else None
        )

    def predict_periodicals_page_count(
        self, aleph_record: AlephRecord, aleph_issue: AlephIssue
    ) -> Optional[int]:
        volume_year = aleph_issue.volume_year or aleph_issue.volume
        body = PredictPeriodicalsPageCount(
            title=aleph_record.title,
            year=parse_year(volume_year),
            frequency=parse_frequency(volume_year, aleph_record.frequencies),
            publisher=aleph_record.publisher,
            language=aleph_record.languages[0],
            region=aleph_record.publishing_place,
            keywords=aleph_record.keywords,
        )
        response = requests.get(
            f"{self.url}/{PREDICT_PERIODICAL_PAGE_COUNT_ENDPOINT}", json=body
        )
        if response.status_code != 200:
            raise Exception("Failed to predict page count")
        return response.json()[PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD]

    @staticmethod
    def get_instance():
        return Predictor(VeraConfig.PredictorUrl)
