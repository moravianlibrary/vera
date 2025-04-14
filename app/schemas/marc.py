from typing import Dict, Any
from pydantic import BaseModel


class MarcRecord(BaseModel):
    data: Dict[str, Any]

    def _get_value(self, tag: str, code: str | None = None) -> str | None:
        if tag not in self.data:
            return None

        value = self.data[tag].get(code) if code else self.data[tag]

        if isinstance(value, list):
            raise ValueError(
                f"Unexpected list value for tag '{tag}' and code '{code}'"
            )

        if not isinstance(value, str):
            raise TypeError(
                "Unrecognized data type for tag "
                f"'{tag}' and code '{code}': {type(value)}"
            )

        return value

    controlNumber: str
    nbn: str | None
    isbn: str | None
    issn: str | None
    isxn: str | None
    title: str | None
    signature: str | None

    @property
    def controlNumber(self) -> str:
        return self._get_value("001")

    @property
    def nbn(self) -> str | None:
        return self._get_value("015", "a")

    @property
    def isbn(self) -> str | None:
        return self._get_value("020", "a")

    @property
    def issn(self) -> str | None:
        return self._get_value("022", "a")

    @property
    def isxn(self) -> str | None:
        return self.isbn or self.issn

    @property
    def signature(self) -> str | None:
        return self._get_value("910", "b")


class MarcIssue(BaseModel):
    _data: Dict[str, Any]

    barcode: str | None
    issueType: str | None
    volumeNumber: str | None
    volumeYear: str | None
    bundle: str | None
