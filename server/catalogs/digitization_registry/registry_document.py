from typing import Dict
from catalogs.enums import DigitizationState


class RegistryDocument:
    def __init__(self, data):
        self.data: Dict = data

    @property
    def title(self) -> str:
        return self.data.get("title")

    @property
    def year(self) -> str:
        return self.data.get("rozsah")

    @property
    def volume(self) -> str:
        return self.data.get("cast")

    @property
    def bundle(self) -> str:
        return self.data.get("cisloper")

    @property
    def digitization_state(self) -> DigitizationState:
        state = self.data.get("stav")
        if state == "dokončeno":
            return DigitizationState.Finished
        elif state == "zpracování":
            return DigitizationState.InProgress
        elif state == "plánováno":
            return DigitizationState.Planned
        elif state == "revize":
            return DigitizationState.Revision
        raise Exception(f"Unknown digitization state: {state}")

    def __str__(self):
        properties = [
            f"title: {self.title}",
            f"year: {self.year}",
            f"volume: {self.volume}",
            f"bundle: {self.bundle}",
            f"digitization_state: {self.digitization_state}",
        ]
        return "\n".join(properties)
