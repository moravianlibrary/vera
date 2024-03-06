from catalogs.enums import IdentifierType
from catalogs.routines import get_document_by_identifier_type
from kramerius.api import KrameriusApi
from kramerius.search import KrameriusSearch, SearchQuery
from kramerius.types import KrameriusModel, SolrField, Wildcard


api = KrameriusApi()
kramerius_search = KrameriusSearch(api)


def find_missing_periodical_volumes():
    return_fields = [
        SolrField.Pid,
        SolrField.Barcode,
        SolrField.Signature,
        SolrField.Cnb,
        SolrField.Sysno,
    ]

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
    for doc in kramerius_search.search(query, return_fields):
        if doc.barcode:
            catalog_document = get_document_by_identifier_type(
                IdentifierType.Barcode, doc.barcode[0]
            )
            print(catalog_document)
