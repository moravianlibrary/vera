from pydantic import BaseModel
from services.parsers.frequency_parser import parse_year, parse_frequency
from mzk_aleph import AlephMzkRecord, AlephMzkIssue
from typing import Any, Type


DEFAULT_YEAR = 1976
DEFAULT_LANGUAGE = "cze"
MISSING_VALUE = "missing"


class PredictPeriodicalsPageCount(BaseModel):
    title: str
    year: int | None = None
    frequency: int
    publisher: str
    language: str
    region: str
    keywords: str

    @classmethod
    def validate_field(
        cls, field_name: str, value: Any, expected_type: Type
    ) -> None:
        if not isinstance(value, expected_type):
            raise TypeError(
                f"The field '{field_name}' "
                f"must be of type {expected_type.__name__}, "
                f"but got {type(value).__name__}."
            )

    @classmethod
    def validate_aleph_record(
        cls, aleph_record: AlephMzkRecord, aleph_issue: AlephMzkIssue
    ) -> "PredictPeriodicalsPageCount":
        # Validate the title
        cls.validate_field("title", aleph_record.title, str)

        # Determine the volume year
        volume_year = aleph_issue.volume_year or aleph_issue.volume
        year = None
        if volume_year is not None:
            try:
                year = parse_year(volume_year)
            except ValueError:
                pass
        cls.validate_field("year", year, int | None)

        # Validate frequency
        frequency = parse_frequency(volume_year, aleph_record.frequencies)
        cls.validate_field("frequency", frequency, int)

        # Validate other fields
        cls.validate_field("publisher", aleph_record.publisher, str | None)
        cls.validate_field("language", aleph_record.language, str | None)
        cls.validate_field("region", aleph_record.publishing_place, str | None)

        # Validate keywords
        cls.validate_field("keywords", aleph_record.keywords, list)

        # Join keywords into a string
        keywords = (
            ",".join(aleph_record.keywords) if aleph_record.keywords else None
        )

        return cls(
            title=aleph_record.title,
            year=year or DEFAULT_YEAR,
            frequency=frequency,
            publisher=aleph_record.publisher or MISSING_VALUE,
            language=aleph_record.language or DEFAULT_LANGUAGE,
            region=aleph_record.publishing_place or MISSING_VALUE,
            keywords=keywords or MISSING_VALUE,
        )
