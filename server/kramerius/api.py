import requests
import os
from time import sleep
from typing import Any, Dict, Optional


WAIT_TIME = 15
kramerius_url = os.getenv("KRAMERIUS_API_URL")


class KrameriusApi:
    def __init__(self, base_url=kramerius_url):
        self.base_url = base_url
        self.curr_wait = 0

    def get_response(self, url: str, params: Optional[Dict[str, Any]] = None):
        response = (
            requests.get(url)
            if params is None
            else requests.get(url, params=params)
        )

        if response.status_code == 200:
            self.curr_wait = 0
            return response.json()

        self.curr_wait += WAIT_TIME
        sleep(self.curr_wait)
        return self.get_response(url, params=params)

    def search(self, params: Dict[str, Any]):
        url = f"{self.base_url}/api/client/v7.0/search"
        return self.get_response(url, params=params)
