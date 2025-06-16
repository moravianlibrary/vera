XLSX_MIMETYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)


class DocumentService:
    pass

    def export(
        query: IndexerQuery = RestrictedQuery(
            OwnershipPermission.ReadDocuments
        ),
        fields: List[str] = Query(default=DEFAULT_EXPORT_FIELDS),
        filename: str = Query(DEFAULT_EXPORT_FILENAME),
        export_format: ExportFormat = Query(ExportFormat.xlsx),
    ):
        df = pd.DataFrame(
            hit["_source"]
            for hit in query_documents(
                parse_query_routing(query_routing_params), user, es_session
            )["hits"]["hits"]
        )

        with tempfile.NamedTemporaryFile(
            suffix=".xlsx", delete=False
        ) as temp_excel:
            df.to_excel(temp_excel.name, index=False)
            temp_filename = temp_excel.name

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        export_filename = f"vera-documents_{timestamp}.xlsx"

        return FileResponse(
            temp_filename,
            media_type=XLSX_MIMETYPE,
            filename=export_filename,
            headers={"Content-Disposition": "attachment"},
        )

    def update_property(
        query: IndexerQuery = RestrictedQuery(
            OwnershipPermission.ManageDocuments
        ),
        property_name: str = Query(...),
        property_value: str | None = Query(None),
    ):
        if (
            not category_id
            and not page_count_manual
            and not extraction_priority
        ):
            return
        for document_id in IndexDocument.search_source_ids(
            es_session,
            restrict_edit_query_params(
                parse_query_routing(query_routing_params), user
            ),
        ):
            document = Document.get(session, document_id)
            if category_id:
                document.category_id = category_id
            if page_count_manual:
                document.pages_count_manual = page_count_manual
            if extraction_priority:
                document.extraction_priority = extraction_priority
            document.save(session)
            IndexDocument.model_validate(document).save(es_session)

    def delete(
        query: IndexerQuery = RestrictedQuery(
            OwnershipPermission.ManageDocuments
        ),
    ):
        for document_id in IndexDocument.search_source_ids(
            es_session,
            restrict_edit_query_params(
                parse_query_routing(query_routing_params), user
            ),
        ):
            Document.get(session, document_id).delete(session)
            IndexDocument.delete(es_session, document_id)
