from typing import List, Dict, Generator
from .adapter_interface import DRAdapterInterface
from schemas import DRAdapterResponse, RDczConfig, Record, Issue
from requests import Session
from custom_types import DRState, DRFetchStatus


HOST = "https://registrdigitalizace.cz"
CHECK_AVAILABILITY_ENDPOINT = "rdcz/search/rdcz/select"
SEARCH_ENDPOINT = "rdcz/search/rdcz/select"
PAGINATE_PAGE_SIZE = 10


class RDczRecord:
    def __init__(self, data):
        self.data: Dict = data

    @property
    def id(self) -> str:
        return self.data.get("id")

    @property
    def record_id(self) -> str:
        return self.data.get("titul_id")

    @property
    def barcode(self) -> str:
        return self.data.get("carkod")

    @property
    def field001(self) -> str:
        return self.data.get("pole001")

    @property
    def title(self) -> str:
        return self.data.get("title")

    @property
    def volumeYear(self) -> str:
        return self.data.get("rozsah")

    @property
    def volumeNumber(self) -> str:
        return self.data.get("cast")

    @property
    def bundle(self) -> str:
        return self.data.get("cisloper")

    @property
    def digitization_state(self) -> DRState:
        state = self.data.get("stav")
        if state == "dokončeno":
            return DRState.Finished
        elif state == "zpracování":
            return DRState.InProgress
        elif state == "plánováno":
            return DRState.Planned
        elif state == "revize":
            return DRState.Revision
        return DRState.Unknown

    def __str__(self):
        properties = [
            f"id: {self.id}",
            f"title: {self.title}",
            f"year: {self.year}",
            f"volume: {self.volume}",
            f"bundle: {self.bundle}",
            f"barcode: {self.barcode}",
            f"digitization_state: {self.digitization_state}",
        ]
        return "\n".join(properties)


class RDczException(Exception):
    pass


class RDczAdapter(DRAdapterInterface):
    def __init__(self, config: RDczConfig):
        self._config = config
        self._session = Session()
        self._session.timeout = config["timeout"] or 30

    def close(self):
        if not self._session.closed:
            self._session.close()

    def __del__(self):
        self.close()

    def is_available(self) -> bool:
        try:
            response = self._session.get(
                f"{HOST}/{CHECK_AVAILABILITY_ENDPOINT}"
            )
            return response.status_code == 200
        except Exception:
            return False

    def _get_query_records(
        self, query: str
    ) -> Generator[RDczRecord, None, None]:
        start = 0

        while True:
            response = self._session.get(
                f"{HOST}/{SEARCH_ENDPOINT}",
                params={
                    "q": query,
                    "start": start,
                    "rows": PAGINATE_PAGE_SIZE,
                },
            )

            response.raise_for_status()

            response_data = response.json()["response"]
            num_found = response_data["numFound"]
            documents = response_data["docs"]

            for document in documents:
                yield RDczRecord(document)

            start += PAGINATE_PAGE_SIZE
            if start >= num_found:
                break

    def getRecord(self, record_id: str) -> DRAdapterResponse:
        documents: List[RDczRecord] = list(
            self.get_query_records(f'id:"{record_id}"')
        )

        if len(documents) > 1:
            raise RDczException("Too many records with the same ID found")

        if len(documents) == 0:
            return DRAdapterResponse(
                source="rdcz",
                status=DRFetchStatus.Unavailable,
            )

        return DRAdapterResponse(
            source="rdcz",
            id=documents[0].id,
            recordState=documents[0].digitization_state,
            status=DRFetchStatus.Success,
        )

    def _get_cnb(self, record: Record) -> str | None:
        return record["015"]["a"]

    def _get_isxn(self, record: Record) -> str | None:
        return record["020"]["a"] or record["022"]["a"]

    def _get_signature(self, record: Record) -> str | None:
        return record["910"]["b"]

    def _strongest_state_record(
        self, rdcz_records: List[RDczRecord]
    ) -> RDczRecord:
        STATE_PRIORITY = {
            DRState.Finished: 1,
            DRState.InProgress: 2,
            DRState.Planned: 3,
            DRState.Revision: 4,
            DRState.Unknown: 5,
        }

        strongest_state = DRState.Unknown

        for rdcz_record in rdcz_records:
            current_state = rdcz_record.digitization_state
            if STATE_PRIORITY[current_state] < STATE_PRIORITY[strongest_state]:
                strongest_state = current_state

        return strongest_state

    def _get_issue_record(
        self, rdcz_records: List[RDczRecord], issue: Issue
    ) -> RDczRecord | None:
        for rdcz_record in rdcz_records:
            if rdcz_record.barcode == issue["barcode"]:
                return rdcz_record
            if (
                rdcz_record.volumeYear == issue["volumeYear"]
                and rdcz_record.volumeNumber == issue["volumeNumber"]
                and rdcz_record.bundle == issue["bundle"]
            ):
                return rdcz_record

    def search(self, record: Record, issue: Issue) -> DRAdapterResponse:
        rdcz_records: Dict[str, RDczRecord] = dict()

        if issue["barcode"]:
            for rdcz_record in self._get_query_records(
                f'carkod:"{issue["barcode"]}"'
            ):
                rdcz_records[rdcz_record.id] = rdcz_record
        else:
            queries: List[str] = []

            if record["001"]:
                queries.append(f'pole001:"{record["001"]}"')
            if record["015"]:
                queries.append(f'cnb:"{record["015"]}"')
            if (
                record["020"]
                or record["022"]
                and (record["020"] or record["022"])["a"]
            ):
                queries.append(
                    f'isxn:"{(record["020"] or record["022"])["a"]}"'
                )
            if record["910"] and record["910"]["b"]:
                queries.append(f'signatura:"{record["910"]["b"]}"')

            for query in queries:
                for rdcz_record in self._get_query_records(query):
                    rdcz_records[rdcz_record.id] = rdcz_record

        if not rdcz_records:
            return DRAdapterResponse(
                source="rdcz",
                recordState=DRState.NotDigitized,
                issueState=DRState.NotDigitized,
                status=DRFetchStatus.Success,
            )
