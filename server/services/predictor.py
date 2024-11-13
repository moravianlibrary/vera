import requests
from typing import Optional
from config import VeraConfig
from schemas import PredictPeriodicalsPageCount
from services.aleph import AlephMzkRecord, AlephMzkIssue
from datatypes import MaterialType


PREDICT_PERIODICAL_PAGE_COUNT_ENDPOINT = "/predict"
PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD = "predicted_pages_count"


class Predictor:
    def __init__(self, url, timeout: int = 30):
        self.url = url
        self.timeout = timeout

    def predict_page_count(
        self, aleph_record: AlephMzkRecord, aleph_issue: AlephMzkIssue
    ):
        return (
            self.predict_periodicals_page_count(aleph_record, aleph_issue)
            if aleph_record.material_type == MaterialType.ContinuingResource
            else None
        )

    def predict_periodicals_page_count(
        self, aleph_record: AlephMzkRecord, aleph_issue: AlephMzkIssue
    ) -> Optional[int]:
        body = PredictPeriodicalsPageCount.validate_aleph_record(
            aleph_record, aleph_issue
        ).model_dump()
        response = requests.post(
            f"{self.url}/{PREDICT_PERIODICAL_PAGE_COUNT_ENDPOINT}",
            json=body,
            timeout=1,
        )
        if response.status_code != 200:
            raise Exception(response.json()["detail"])
        return response.json()[PREDICT_PERIODICAL_PAGE_COUNT_KEYWORD]

    @staticmethod
    def get_instance():
        return Predictor(VeraConfig.PredictorUrl)
