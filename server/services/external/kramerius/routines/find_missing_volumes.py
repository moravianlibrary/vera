from typing import Callable, IO, Optional

from catalogs.aleph_document import AlephDocument, AlephIssue
from catalogs.enums import CatalogResponseStatus, IdentifierType, IssuanceType
from catalogs.routines import get_document_by_identifier_type
from kramerius.client import KrameriusApi
from kramerius.document import KrameriusDocument
from kramerius.parsers import range_end_year, range_start_year
from kramerius.search import KrameriusSearch, SearchQuery
from datatypes import KrameriusModel, SolrField, Wildcard


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
    SolrField.Title,
]
ITEM_FIELDS = [
    SolrField.Pid,
    SolrField.PartNumberSort,
    SolrField.PartNumberString,
    SolrField.TitleSort,
]

api = KrameriusApi()
kramerius_search = KrameriusSearch(api)


def match_issuance_date_aleph_issue_kramerius_item(
    issue: AlephIssue, item: KrameriusDocument
):
    return issue.bundle is not None and (
        issue.bundle == item.part_number_string or issue.bundle == item.title
    )


def match_issuance_date_aleph_issue_kramerius_volume(
    issue: AlephIssue, volume: KrameriusDocument
):
    return issue.type == IssuanceType.Volume and (
        (
            issue.volume is not None
            and issue.volume == volume.part_number_string
        )
        or (
            issue.year is not None
            and (
                range_start_year(issue.year) == volume.date_range_start_year
                and range_end_year(issue.year) == volume.date_range_end_year
                or issue.year == volume.title
            )
        )
    )


def is_same_issue(issue: AlephIssue, volume: KrameriusDocument):
    if match_issuance_date_aleph_issue_kramerius_volume(issue, volume):
        return True

    query = (
        SearchQuery(SolrField.ParentPid, volume.pid)
        .and_(SolrField.Model, KrameriusModel.PeriodicalItem)
        .build()
    )

    for item in kramerius_search.search(query, ITEM_FIELDS):
        if match_issuance_date_aleph_issue_kramerius_item(issue, item):
            return True
    return False


def is_missing_issue(issue: AlephIssue, periodical: KrameriusDocument):
    query = (
        SearchQuery(SolrField.ParentPid, periodical.pid)
        .and_(SolrField.Model, KrameriusModel.PeriodicalVolume)
        .build()
    )

    for volume in kramerius_search.search(query, VOLUME_FIELDS):
        if match_issuance_date_aleph_issue_kramerius_item(issue, volume):
            return False
    return True


def find_catalog_document_for_kramerius_document(document: KrameriusDocument):
    catalog_response = None
    if document.barcode:
        for barcode in document.barcode:
            catalog_document, catalog_response = (
                get_document_by_identifier_type(
                    IdentifierType.Barcode, barcode
                )
            )
            if catalog_response == CatalogResponseStatus.Success:
                return catalog_document

    if document.sysno:
        for sysno in document.sysno:
            catalog_document, catalog_response = (
                get_document_by_identifier_type(IdentifierType.Sysno, sysno)
            )
            if catalog_response == CatalogResponseStatus.Success:
                return catalog_document


def find_missing_issues_for_periodical(
    periodical: KrameriusDocument, catalog_document: AlephDocument
):
    query = (
        SearchQuery(SolrField.ParentPid, periodical.pid)
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
            if is_same_issue(issue, volume):
                digitized = True
                break

        if not digitized:
            not_digitized_issues.append(issue)

    return not_digitized_issues


def find_missing_periodical_volumes(
    missing_issues_processor: Callable[
        [KrameriusDocument, AlephDocument, AlephIssue], None
    ]
):
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

    for periodical in kramerius_search.search(query, ROOT_FIELDS):
        catalog_document = find_catalog_document_for_kramerius_document(
            periodical
        )
        if catalog_document is None:
            continue
        else:
            for issue in find_missing_issues_for_periodical(
                periodical, catalog_document
            ):
                missing_issues_processor(periodical, catalog_document, issue)


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
