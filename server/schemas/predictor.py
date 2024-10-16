from pydantic import BaseModel
from services.parsers.frequency_parser import parse_year, parse_frequency
from services.external.aleph import AlephRecord, AlephIssue
from typing import Any, Type


class PredictPeriodicalsPageCount(BaseModel):
    title: str
    year: int
    frequency: int
    publisher: str
    language: str
    region: str
    keywords: str

    @classmethod
    def validate_field(
        cls, field_name: str, value: Any, expected_type: Type
    ) -> None:
        if value is None:
            raise ValueError(f"The field '{field_name}' must not be None.")
        if not isinstance(value, expected_type):
            raise TypeError(
                f"The field '{field_name}' "
                f"must be of type {expected_type.__name__}, "
                f"but got {type(value).__name__}."
            )

    @classmethod
    def validate_aleph_record(
        cls, aleph_record: AlephRecord, aleph_issue: AlephIssue
    ) -> "PredictPeriodicalsPageCount":
        # Validate the title
        cls.validate_field("title", aleph_record.title, str)

        # Determine the volume year
        volume_year = aleph_issue.volume_year or aleph_issue.volume
        year = parse_year(volume_year)
        cls.validate_field("year", year, int)

        # Validate frequency
        frequency = parse_frequency(volume_year, aleph_record.frequencies)
        cls.validate_field("frequency", frequency, int)

        # Validate other fields
        cls.validate_field("publisher", aleph_record.publisher, str)
        cls.validate_field("language", aleph_record.language, str)
        cls.validate_field("region", aleph_record.publishing_place, str)

        # Validate keywords
        cls.validate_field("keywords", aleph_record.keywords, list)

        # Join keywords into a string
        keywords = ",".join(aleph_record.keywords)

        return cls(
            title=aleph_record.title,
            year=year,
            frequency=frequency,
            publisher=aleph_record.publisher,
            language=aleph_record.language,
            region=aleph_record.publishing_place,
            keywords=keywords,
        )
