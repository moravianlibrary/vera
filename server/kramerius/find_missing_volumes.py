from typing import IO, Optional

from catalogs.aleph_document import AlephDocument, AlephIssue
from catalogs.enums import CatalogResponseStatus, IdentifierType, IssuanceType
from catalogs.routines import get_document_by_identifier_type
from kramerius.api import KrameriusApi
from kramerius.document import KrameriusDocument
from kramerius.parsers import range_end_year, range_start_year
from kramerius.search import KrameriusSearch, SearchQuery
from kramerius.types import KrameriusModel, SolrField, Wildcard


ROOT_FIELDS = [
    SolrField.Pid,
    SolrField.Barcode,
    SolrField.Signature,
    SolrField.Cnb,
    SolrField.Sysno,
    SolrField.Title,
]
VOLUME_FIELDS = [
    SolrField.Pid,
    SolrField.PartNumberSort,
    SolrField.PartNumberString,
    SolrField.DateRangeStartYear,
    SolrField.DateRangeEndYear,
]
ITEM_FIELDS = [
    SolrField.Pid,
    SolrField.PartNumberSort,
    SolrField.PartNumberString,
    SolrField.TitleSort,
]

api = KrameriusApi()
kramerius_search = KrameriusSearch(api)


def issue_matches_item(issue: AlephIssue, item: KrameriusDocument):
    return (
        issue.bundle == item.part_number_string
        or issue.bundle == item.title_sort
    )


def issue_matches_volume_item(issue: AlephIssue, volume: KrameriusDocument):
    if issue.type == IssuanceType.Bundle:
        return True

    query = (
        SearchQuery(SolrField.ParentPid, volume.pid)
        .and_(SolrField.Model, KrameriusModel.PeriodicalItem)
        .build()
    )

    for item in kramerius_search.search(query, ITEM_FIELDS):
        if issue_matches_item(issue, item):
            return True


def issue_matches_volume(issue: AlephIssue, volume: KrameriusDocument):
    return issue.type == IssuanceType.Volume and (
        issue.volume == volume.part_number_string
        or (
            range_start_year(issue.year) == volume.date_range_start_year
            and range_end_year(issue.year) == volume.date_range_end_year
        )
    )


def write_output(
    file: IO[str],
    parent: KrameriusDocument,
    catalog_document: AlephDocument,
    issue: AlephIssue,
):
    def parse_to_csv_cell(value: Optional[str]) -> str:
        if value is None:
            return ""
        if '"' in value:
            value = value.replace('"', '""')
            return f'"{value}"'
        elif "," in value:
            return f'"{value}"'
        return value

    file.write(
        f"{parent.pid},"
        f"{parse_to_csv_cell(parent.title)},"
        f"{parse_to_csv_cell(catalog_document.title)},"
        f"{catalog_document.sysno},"
        f"{issue.type.value},"
        f"{issue.barcode},"
        f"{parse_to_csv_cell(issue.year)},"
        f"{parse_to_csv_cell(issue.volume)},"
        f"{parse_to_csv_cell(issue.bundle)}\n"
    )


def find_missing_volumes_for(file, document: KrameriusDocument):
    catalog_response = None
    if document.barcode:
        for barcode in document.barcode:
            catalog_response = get_document_by_identifier_type(
                IdentifierType.Barcode, barcode
            )
            if catalog_response[1] == CatalogResponseStatus.Success:
                break

    if (
        not catalog_response
        or catalog_response[1] != CatalogResponseStatus.Success
    ) and document.sysno:
        for sysno in document.sysno:
            catalog_response = get_document_by_identifier_type(
                IdentifierType.Sysno, sysno
            )

    if (
        not catalog_response
        or catalog_response[1] != CatalogResponseStatus.Success
    ):
        return

    catalog_document: AlephDocument = catalog_response[0]
    query = (
        SearchQuery(SolrField.ParentPid, document.pid)
        .and_(SolrField.Model, KrameriusModel.PeriodicalVolume)
        .build()
    )

    digitized_volumes = [
        doc for doc in kramerius_search.search(query, VOLUME_FIELDS)
    ]

    not_digitized_issues = []

    for issue in catalog_document.issues:
        digitized = False
        for volume in digitized_volumes:
            if issue_matches_volume(
                issue, volume
            ) or issue_matches_volume_item(issue, volume):
                digitized = True
                break

        if not digitized:
            not_digitized_issues.append(issue)

    for issue in not_digitized_issues:
        write_output(file, document, catalog_document, issue)


def find_missing_periodical_volumes(file):
    # docs = {}

    query = (
        SearchQuery(SolrField.Model, KrameriusModel.Periodical)
        .sub_query(
            SearchQuery(SolrField.Barcode, Wildcard)
            .or_(SolrField.Signature, Wildcard)
            .or_(SolrField.Cnb, Wildcard)
            .or_(SolrField.Sysno, Wildcard)
        )
        .build()
    )

    for document in kramerius_search.search(query, ROOT_FIELDS):
        find_missing_volumes_for(file, document)
