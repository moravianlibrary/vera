from typing import List
from datatypes import EsRoutingParams
from config import VeraConfig


def parse_query_routing(query_routing_params: EsRoutingParams) -> List[str]:
    query_params = {
        "_source": query_routing_params.get("fields", "id").split(","),
        "query": {"bool": {"must": []}},
    }

    if query_routing_params.get("query"):
        fields = (VeraConfig.Elasticsearch.CatalogRecordsQueryFields,)
        fuzziness = (VeraConfig.Elasticsearch.CatalogRecordsQueryFuzziness,)

        fuzzy = {
            "bool": {
                "should": [
                    {
                        "multi_match": {
                            "fields": fields,
                            "fuzziness": fuzziness,
                            "query": query_routing_params["query"],
                        }
                    },
                    {
                        "multi_match": {
                            "fields": fields,
                            "type": "bool_prefix",
                            "query": query_routing_params["query"],
                        }
                    },
                ]
            }
        }
        exact = {
            "multi_match": {
                "fields": fields,
                "query": query_routing_params["query"],
                "type": "phrase",
            }
        }

        query_params["query"]["bool"]["must"].append(
            {"bool": {"should": [fuzzy, exact]}}
        )

    for field, values in query_routing_params.items():
        print(field, values)
        if field in ["query", "index_name", "page", "page_size"]:
            continue

        value_list = [value.strip() for value in values.split(",")]
        if len(value_list) > 1:
            query_params["query"]["bool"]["must"].append(
                {"terms": {field: value_list}}
            )
        else:
            query_params["query"]["bool"]["must"].append(
                {"match": {field: value_list[0]}}
            )

    return query_params
