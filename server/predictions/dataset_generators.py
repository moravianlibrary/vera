import re
from typing import List

from catalogs.schemas import Frequency
from kramerius.api import KrameriusApi
from kramerius.document import KrameriusDocument
from kramerius.search import KrameriusSearch, SearchQuery
from kramerius.types import KrameriusModel, SolrField
from predictions.frequency_parser import parse_frequency
from services.csv_writer import CsvWriter


NS_MODS = {"mods": "http://www.loc.gov/mods/v3"}

FL_PERIODICAL = [
    SolrField.Pid,
    SolrField.Title,
    SolrField.PublishersFacet,
    SolrField.PublicationPlacesFacet,
    SolrField.LanguagesFacet,
]

FL_VOLUME = [
    SolrField.Pid,
    SolrField.PartNumberSort,
    SolrField.DateRangeStartYear,
    SolrField.DateRangeEndYear,
    SolrField.PublishersFacet,
    SolrField.PublicationPlacesFacet,
    SolrField.LanguagesFacet,
]

FL_ITEM = [SolrField.Pid, SolrField.PartNumberSort, SolrField.PagesCount]

VOLUMES_CSV_HEADER = [
    "Title",
    "Year",
    "Frequency",
    "Number of items" "Publisher",
    "Publication place",
    "Language",
    "Pages count",
]

ITEMS_CSV_HEADER = [
    "Title",
    "Year",
    "Item number",
    "Publisher",
    "Publication place",
    "Language",
    "Pages count",
]


class VolumesDatasetGenerator:
    def __init__(self, csv_writer: CsvWriter):
        self.csv_writer = csv_writer
        self.api = KrameriusApi()
        self.search = KrameriusSearch(self.api)

    def generate(self):
        self.csv_writer.write(VOLUMES_CSV_HEADER)
        periodicals = [
            document
            for document in self.search.search(
                SearchQuery(
                    SolrField.Model, KrameriusModel.Periodical
                ).build(),
                fl=FL_PERIODICAL,
            )
        ]

        for periodical in periodicals:
            if periodical.title is None:
                continue
            mods = self.api.get_mods(periodical.pid)
            frequency_elements = mods.xpath(
                "//mods:frequency/text()", namespaces=NS_MODS
            )
            frequencies: List[Frequency] = parse_kramerius_frequencies(
                frequency_elements
            )
            self._generate_for_periodical(periodical, frequencies)

    def _generate_for_periodical(
        self, periodical: KrameriusDocument, frequencies: List[str]
    ):
        for volume in self.search.search(
            SearchQuery(SolrField.Model, KrameriusModel.PeriodicalVolume)
            .and_(SolrField.ParentPid, periodical.pid)
            .build(),
            fl=FL_VOLUME,
        ):
            self._generate_for_volume(periodical, volume, frequencies)

    def _generate_for_volume(
        self,
        periodical: KrameriusDocument,
        volume: KrameriusDocument,
        frequencies: List[str],
    ):
        title: str = periodical.title

        year: int = 0
        if (
            volume.date_range_start_year is not None
            and volume.date_range_end_year is not None
            and volume.date_range_start_year == volume.date_range_end_year
        ):
            year = volume.date_range_start_year
        elif (
            volume.part_number_sort is not None
            and volume.part_number_sort > 1600
        ):
            year = volume.part_number_sort
        else:
            return

        publisher: str = ""
        if (
            volume.publishers_facet is not None
            and len(volume.publishers_facet) > 0
        ):
            publisher = volume.publishers_facet[0]
        elif (
            periodical.publishers_facet is not None
            and len(periodical.publishers_facet) > 0
        ):
            publisher = periodical.publishers_facet[0]
        else:
            return

        publication_place: str = ""
        # TODO: Change for parsing city names
        volume_publication_places = (
            [
                p
                for p in volume.publication_places_facet
                if not p.startswith("X") and not p.startswith("x")
            ]
            if volume.publication_places_facet is not None
            else []
        )
        periodical_publication_places = (
            [p for p in periodical.publication_places_facet if "X" not in p]
            if periodical.publication_places_facet is not None
            else []
        )
        if len(volume_publication_places) > 0:
            publication_place = volume_publication_places[0]
        elif len(periodical_publication_places) > 0:
            publication_place = periodical_publication_places[0]
        else:
            return
        publication_place = (
            publication_place.replace("?", "")
            .replace("[", "")
            .replace("]", "")
        )

        language: str = ""
        if (
            volume.languages_facet is not None
            and len(volume.languages_facet) > 0
        ):
            language = volume.languages_facet[0]
        elif (
            periodical.languages_facet is not None
            and len(periodical.languages_facet) > 0
        ):
            language = periodical.languages_facet[0]
        else:
            return

        frequency: int = parse_frequency(str(year), frequencies)

        number_of_items: int = 0
        pages_count: int = 0

        def get_not_page_descendants(pid):
            nonlocal number_of_items
            nonlocal pages_count
            for document in self.search.search(
                SearchQuery(SolrField.ParentPid, pid)
                .and_not_(SolrField.Model, KrameriusModel.Page)
                .build(),
                fl=[SolrField.Pid, SolrField.PagesCount, SolrField.Model],
            ):
                if (
                    document.model == KrameriusModel.PeriodicalItem
                    or document.model == KrameriusModel.Supplement
                ):
                    number_of_items += 1
                if document.pages_count is not None:
                    pages_count += document.pages_count
                get_not_page_descendants(document.pid)

        get_not_page_descendants(volume.pid)

        self.csv_writer.write(
            [
                title,
                year,
                frequency,
                number_of_items,
                publisher,
                publication_place,
                language,
                pages_count,
            ]
        )


class ItemsDatasetGenerator:
    def __init__(self, csv_writer: CsvWriter):
        self.csv_writer = csv_writer
        self.api = KrameriusApi()
        self.search = KrameriusSearch(self.api)

    def generate(self):
        self.csv_writer.write(ITEMS_CSV_HEADER)

        periodicals = [
            document
            for document in self.search.search(
                SearchQuery(
                    SolrField.Model, KrameriusModel.Periodical
                ).build(),
                fl=FL_PERIODICAL,
            )
        ]

        for periodical in periodicals:
            if periodical.title is None:
                continue
            self._generate_for_periodical(periodical)

    def _generate_for_periodical(self, periodical: KrameriusDocument):
        for volume in self.search.search(
            SearchQuery(SolrField.Model, KrameriusModel.PeriodicalVolume)
            .and_(SolrField.ParentPid, periodical.pid)
            .build(),
            fl=FL_VOLUME,
        ):
            self._generate_for_volume(periodical, volume)

    def _generate_for_volume(
        self,
        periodical: KrameriusDocument,
        volume: KrameriusDocument,
    ):
        title: str = periodical.title

        year: int = 0
        if (
            volume.date_range_start_year is not None
            and volume.date_range_end_year is not None
            and volume.date_range_start_year == volume.date_range_end_year
        ):
            year = volume.date_range_start_year
        elif (
            volume.part_number_sort is not None
            and volume.part_number_sort > 1600
        ):
            year = volume.part_number_sort
        else:
            return

        publisher: str = ""
        if (
            volume.publishers_facet is not None
            and len(volume.publishers_facet) > 0
        ):
            publisher = volume.publishers_facet[0]
        elif (
            periodical.publishers_facet is not None
            and len(periodical.publishers_facet) > 0
        ):
            publisher = periodical.publishers_facet[0]
        else:
            return

        publication_place: str = ""
        # TODO: Change for parsing city names
        volume_publication_places = (
            [
                p
                for p in volume.publication_places_facet
                if not p.startswith("X") and not p.startswith("x")
            ]
            if volume.publication_places_facet is not None
            else []
        )
        periodical_publication_places = (
            [p for p in periodical.publication_places_facet if "X" not in p]
            if periodical.publication_places_facet is not None
            else []
        )
        if len(volume_publication_places) > 0:
            publication_place = volume_publication_places[0]
        elif len(periodical_publication_places) > 0:
            publication_place = periodical_publication_places[0]
        else:
            return
        publication_place = (
            publication_place.replace("?", "")
            .replace("[", "")
            .replace("]", "")
        )

        language: str = ""
        if (
            volume.languages_facet is not None
            and len(volume.languages_facet) > 0
        ):
            language = volume.languages_facet[0]
        elif (
            periodical.languages_facet is not None
            and len(periodical.languages_facet) > 0
        ):
            language = periodical.languages_facet[0]
        else:
            return

        for item in self.search.search(
            SearchQuery(SolrField.Model, KrameriusModel.PeriodicalItem)
            .and_(SolrField.ParentPid, volume.pid)
            .and_(SolrField.PartNumberSort, "*")
            .build(),
            fl=FL_ITEM,
        ):
            item_number: int = item.part_number_sort
            pages_count: int = item.pages_count

            self.csv_writer.write(
                [
                    title,
                    year,
                    item_number,
                    publisher,
                    publication_place,
                    language,
                    pages_count,
                ]
            )


def parse_kramerius_frequencies(frequency_elements) -> List[Frequency]:
    frequencies = []
    for freq in frequency_elements:
        for sub_freq in freq.split(";"):
            date_pattern = (
                r"\b(\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\.\d{4}|\d{4})\b"
            )
            match = re.search(date_pattern, sub_freq)
            if "," in sub_freq:
                splitted = sub_freq.split(",")
            elif match:
                splitted_by_year = re.split(date_pattern, sub_freq, maxsplit=1)
                splitted = [
                    splitted_by_year[0],
                    splitted_by_year[1] + splitted_by_year[2],
                ]
            else:
                splitted = [sub_freq]
            frequencies.append(
                Frequency(
                    frequency=splitted[0].replace("?", "").strip(),
                    date=(
                        splitted[1].replace("?", "").strip()
                        if len(splitted) > 1
                        else None
                    ),
                )
            )
    return frequencies


def get_descendants_pages_count(search: KrameriusSearch, pid: str) -> int:
    pages_count = 0

    def get_not_page_descendants(pid):
        nonlocal pages_count
        for document in search.search(
            SearchQuery(SolrField.ParentPid, pid)
            .and_not_(SolrField.Model, KrameriusModel.Page)
            .build(),
            fl=[SolrField.Pid, SolrField.PagesCount],
        ):
            if document.pages_count is not None:
                pages_count += document.pages_count
            get_not_page_descendants(document.pid)

    get_not_page_descendants(pid)
    return pages_count
