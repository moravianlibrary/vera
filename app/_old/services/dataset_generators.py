import re
from typing import List

from datatypes import KrameriusModel, SolrField
from kramerius.client import KrameriusApi
from kramerius.document import KrameriusDocument
from kramerius.search import KrameriusSearch, SearchQuery
from predictions.frequency_parser import parse_frequency

from schemas import Frequency
from services.csv_writer import CsvWriter

NS_MODS = {"mods": "http://www.loc.gov/mods/v3"}

FL_PERIODICAL = [
    SolrField.Pid,
    SolrField.Title,
    SolrField.PublishersFacet,
    SolrField.PublicationPlacesFacet,
    SolrField.LanguagesFacet,
    SolrField.strsFacet,
]

FL_VOLUME = [
    SolrField.ParentPid,
    SolrField.Pid,
    SolrField.PartNumberSort,
    SolrField.DateRangeStartYear,
    SolrField.DateRangeEndYear,
    SolrField.PublishersFacet,
    SolrField.PublicationPlacesFacet,
    SolrField.LanguagesFacet,
    SolrField.strsFacet,
]

FL_SUB_VOLUMES = [
    SolrField.OwnPidPath,
    SolrField.Model,
    SolrField.PartNumberSort,
    SolrField.PagesCount,
    SolrField.strsFacet,
]

FL_ITEM = [
    SolrField.Pid,
    SolrField.PartNumberSort,
    SolrField.PagesCount,
    SolrField.strsFacet,
]

VOLUMES_CSV_HEADER = [
    "Title",
    "Year",
    "Frequency",
    "Number of items",
    "Publisher",
    "Publication place",
    "Language",
    "strs",
    "Pages count",
]

ITEMS_CSV_HEADER = [
    "Title",
    "Year",
    "Item number",
    "Publisher",
    "Publication place",
    "Language",
    "strs",
    "Pages count",
]


class VolumesDatasetGenerator:
    def __init__(self, csv_writer: CsvWriter):
        self.csv_writer = csv_writer
        self.api = KrameriusApi()
        self.search = KrameriusSearch(self.api)

    def generate(self):
        self.csv_writer.write(VOLUMES_CSV_HEADER)

        volumes = {}
        for volume in self.search.search(
            SearchQuery(
                SolrField.Model, KrameriusModel.PeriodicalVolume
            ).build(),
            fl=FL_VOLUME,
        ):
            if volume.parentPid not in volumes:
                volumes[volume.parentPid] = []
            volumes[volume.parentPid].append(volume)

        sub_volumes = {}
        for sub_volume in self.search.search(
            SearchQuery(SolrField.Model, KrameriusModel.PeriodicalItem)
            .or_(SolrField.Model, KrameriusModel.Supplement)
            .or_(SolrField.Model, KrameriusModel.Article)
            .build(),
            fl=FL_SUB_VOLUMES,
        ):
            path_split = sub_volume.ownPidPath.split("/")
            if len(path_split) < 3:
                continue
            volume_pid = path_split[1]
            if volume_pid not in sub_volumes:
                sub_volumes[volume_pid] = []
            sub_volumes[volume_pid].append(sub_volume)

        for periodical in self.search.search(
            SearchQuery(SolrField.Model, KrameriusModel.Periodical).build(),
            fl=FL_PERIODICAL,
        ):
            if periodical.title is None:
                continue
            mods = self.api.get_mods(periodical.pid)
            frequency_elements = mods.xpath(
                "//mods:frequency/text()", namespaces=NS_MODS
            )
            frequencies: List[Frequency] = parse_kramerius_frequencies(
                frequency_elements
            )

            periodical_volumes = volumes.get(periodical.pid, [])

            for volume in periodical_volumes:
                self.process_volume(
                    volume,
                    periodical,
                    sub_volumes.get(volume.pid, []),
                    frequencies,
                )

    def process_volume(
        self,
        volume: KrameriusDocument,
        periodical: KrameriusDocument,
        sub_volumes: List[KrameriusDocument],
        frequencies: List[Frequency],
    ):
        title = self.get_title(periodical)
        if title is None:
            return
        year = self.get_year(volume)
        frequency = (
            self.get_frequency(year, frequencies) if year is not None else None
        )
        self.csv_writer.write(
            [
                title,
                year,
                frequency,
                self.get_number_of_items(sub_volumes),
                self.get_publisher(volume, periodical),
                self.get_publication_place(volume, periodical),
                self.get_language(volume, periodical),
                ",".join(
                    set(self.get_keywords(volume, periodical, sub_volumes))
                ),
                self.get_page_count(sub_volumes),
            ]
        )

    def get_title(self, periodical: KrameriusDocument):
        return periodical.title

    def get_year(self, volume: KrameriusDocument):
        if (
            volume.date_range_start_year is not None
            and volume.date_range_end_year is not None
            and volume.date_range_start_year == volume.date_range_end_year
        ):
            return volume.date_range_start_year
        elif (
            volume.part_number_sort is not None
            and volume.part_number_sort > 1600
        ):
            return volume.part_number_sort
        return None

    def get_publisher(
        self, volume: KrameriusDocument, periodical: KrameriusDocument
    ):
        if (
            volume.publishers_facet is not None
            and len(volume.publishers_facet) > 0
        ):
            return volume.publishers_facet[0]
        elif (
            periodical.publishers_facet is not None
            and len(periodical.publishers_facet) > 0
        ):
            return periodical.publishers_facet[0]
        return None

    def get_publication_place(
        self, volume: KrameriusDocument, periodical: KrameriusDocument
    ):
        for document in [volume, periodical]:
            if document.publication_places_facet is not None:
                for p in document.publication_places_facet:
                    if not p.startswith("X") and not p.startswith("x"):
                        return (
                            p.replace("?", "")
                            .replace("[", "")
                            .replace("]", "")
                        )

        return []

    def get_language(
        self, volume: KrameriusDocument, periodical: KrameriusDocument
    ):
        for document in [volume, periodical]:
            if (
                document.languages_facet is not None
                and len(document.languages_facet) > 0
            ):
                return document.languages_facet[0]

        return None

    def get_frequency(self, year: int, frequencies: List[Frequency]):
        return parse_frequency(str(year), frequencies)

    def get_keywords(
        self,
        volume: KrameriusDocument,
        periodical: KrameriusDocument,
        sub_volumes: List[KrameriusDocument],
    ):
        keywords: List[str] = periodical.keywords_facet or []

        if volume.keywords_facet is not None:
            keywords.extend(volume.keywords_facet)

        for sub_volume in sub_volumes:
            if sub_volume.keywords_facet is not None:
                keywords.extend(sub_volume.keywords_facet)

        return keywords

    def get_number_of_items(self, sub_volumes: List[KrameriusDocument]):
        number_of_items = 0
        for sub_volume in sub_volumes:
            if (
                sub_volume.model == KrameriusModel.PeriodicalItem.value
                or sub_volume.model == KrameriusModel.Supplement.value
            ):
                if sub_volume.part_number_string is not None:
                    matcher = re.match(
                        r"\b(\d+)-(\d+)\b", sub_volume.part_number_string
                    )
                    if matcher:
                        number_of_items += (
                            int(matcher.group(2)) - int(matcher.group(1)) + 1
                        )
                    elif re.match(r"\b\d+\b", sub_volume.part_number_string):
                        number_of_items += 1
                else:
                    number_of_items += 1
        return number_of_items

    def get_page_count(self, sub_volumes: List[KrameriusDocument]):
        return sum(
            sub_volume.pages_count
            for sub_volume in sub_volumes
            if sub_volume.pages_count is not None
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

        keywords: List[str] = periodical.keywords_facet or []
        if volume.keywords_facet is not None:
            keywords.extend(volume.keywords_facet)

        for item in self.search.search(
            SearchQuery(SolrField.Model, KrameriusModel.PeriodicalItem)
            .and_(SolrField.ParentPid, volume.pid)
            .and_(SolrField.PartNumberSort, "*")
            .build(),
            fl=FL_ITEM,
        ):
            item_number: int = item.part_number_sort
            pages_count: int = item.pages_count
            if item.keywords_facet is not None:
                keywords.extend(item.keywords_facet)

            self.csv_writer.write(
                [
                    title,
                    year,
                    item_number,
                    publisher,
                    publication_place,
                    language,
                    ",".join(set(keywords)),
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


if __name__ == "__main__":
    csv_writer = CsvWriter(1)
    generator = VolumesDatasetGenerator(csv_writer)
    generator.generate()
    with open("/tmp/volumes_dataset.csv", "w") as output_file:
        output_file.writelines(csv_writer._convert_to_csv_text())
