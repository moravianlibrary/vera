import requests
from datetime import datetime

import json


SDNNT_URL = "https://sdnnt.nkp.cz/sdnnt/api/v1.0"
SDNNT_LIBRARY = "mzk"

LIST_DNNTO_ENDPOINT = "/lists/added/dnnto"


class SdnntApi:
    def __init__(self):
        self.session = requests.Session()

    def list_added_dnnto(
        self,
        digital_library: str,
        format: str,
        institution: str,
        from_date: datetime,
        rows: int,
    ):
        resumption_token = None
        next_resumption_token = "*"
        while resumption_token != next_resumption_token:
            resumption_token = next_resumption_token
            params = {
                "digital_library": digital_library,
                "format": format,
                "institution": institution,
                "from": from_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                "rows": rows,
                "resumptionToken": resumption_token,
            }

            response = self.session.get(
                f"{SDNNT_URL}{LIST_DNNTO_ENDPOINT}", params=params
            )
            response.raise_for_status()
            data = response.json()

            for document in data["items"]:
                yield document
            next_resumption_token = data.get("resumptiontoken", None)


if __name__ == "__main__":
    sdnnt_api = SdnntApi()
    for document in sdnnt_api.list_added_dnnto(
        digital_library=None,
        format="BK",
        institution="BOA001",
        from_date=datetime(2000, 1, 1),
        rows=10,
    ):
        print(json.dumps(document, ensure_ascii=False))
