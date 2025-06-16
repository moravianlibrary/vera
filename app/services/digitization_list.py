from repositories import DigiListRepository, IntentionRepository


class DigiListService:
    def __init__(
        self,
        digitization_list_r: DigiListRepository,
        document_r: DocumentRepository,
        intention_r: IntentionRepository,
    ):
        self.digitization_list_r = digitization_list_r
        self.document_r = document_r
        self.intention_r = intention_r

    def create(
        query_routing_params: EsRoutingParams,
        intention_ids: List[int],
        ignore_digitization_states: List[DigitizationState],
        created_by: str,
    ):
        document_ids = IndexDocument.search_source_ids(
            es_session, parse_query_routing(query_routing_params)
        )
        if not document_ids:
            raise EmptyExtractionException()

        digitization_list = (
            DigitizationList(intention_id=intention_id, created_by=created_by)
            .save(session)
            .add_documents(session, document_ids, ignore_digitization_states)
        )

        for document_id in document_ids:
            IndexDocument.model_validate(
                Document.get(session, document_id)
            ).save(es_session)

        return digitization_list

    def update(
        digitization_list_id: int,
        intention_ids: List[int] = None,
    ):
        pass

    def add_documents(
        query_routing_params: EsRoutingParams,
        digitization_list_id: int,
        ignore_digitization_states: List[DigitizationState],
    ):
        document_ids = IndexDocument.search_source_ids(
            es_session, parse_query_routing(query_routing_params)
        )

        digitization_list = DigitizationList.get(session, digitization_list_id)
        digitization_list.add_documents(
            session, document_ids, set(ignore_digitization_states)
        )

        for document_id in document_ids:
            IndexDocument.model_validate(
                Document.get(session, document_id)
            ).save(es_session)

        return digitization_list

    def remove_documents(
        query_routing_params: EsRoutingParams, digitization_list_id: int
    ):
        document_ids = IndexDocument.search_source_ids(
            es_session, parse_query_routing(query_routing_params)
        )

        digitization_list = DigitizationList.get(session, digitization_list_id)
        digitization_list.remove_documents(session, document_ids)

        for document_id in document_ids:
            IndexDocument.model_validate(
                Document.get(session, document_id)
            ).save(es_session)

        return digitization_list

    def delete(digitization_list_id: int):
        digitization_list = DigitizationList.get(session, digitization_list_id)

        for document in digitization_list.documents:
            IndexDocument.model_validate(document).save(es_session)

        return digitization_list.delete(session)
