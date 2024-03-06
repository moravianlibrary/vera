import requests
import os
from typing import Any, Dict


kramerius_url = os.getenv("KRAMERIUS_API_URL")


class KrameriusApi:
    def __init__(self, base_url=kramerius_url):
        self.base_url = base_url

    def search(self, params: Dict[str, Any]):
        url = f"{self.base_url}/api/client/v7.0/search"
        response = requests.get(url, params=params)
        return response.json()
