from typing import Dict, Generator, List
from schemas import CurrentUser
from datatypes import ActionType, ElasticsearchParams


def restrict_read_query_params(
    query_params: ElasticsearchParams, user: CurrentUser
):
    if user.has_action(ActionType.ReadDatatableAll):
        return query_params
    if user.has_action(ActionType.ReadDatatableDepartment):
        return restrict_query_params_for_categories(
            query_params, user.department_categories_ids, user.username
        )
    if user.has_action(ActionType.ReadDatatableOwn):
        return restrict_query_params_for_username(query_params, user.username)
    raise Exception("User without read permission trying to read documents")


def restrict_edit_query_params(
    query_params: ElasticsearchParams, user: CurrentUser
) -> ElasticsearchParams:
    if user.has_action(ActionType.EditDatatableAll):
        return query_params
    if user.has_action(ActionType.EditDatatableDepartment):
        return restrict_query_params_for_categories(
            query_params, user.department_categories_ids
        )
    if user.has_action(ActionType.EditDatatableOwn):
        return restrict_query_params_for_username(query_params, user.username)
    raise Exception("User without edit permission trying to edit documents")


def restrict_query_params(
    query_params: Dict[str, any], restriction_clause: Dict[str, any]
):
    if "match_all" in query_params["query"]:
        query_params["query"] = {"bool": {"must": [restriction_clause]}}
    elif "match" in query_params["query"]:
        # match and bool are mutually exclusive, so it is guaranteed that
        # valid query params would not contain both
        match_clause = query_params["query"].pop("match")
        query_params["query"]["bool"] = {
            "must": [
                restriction_clause,
                {"term": match_clause},
            ]
        }
    elif "bool" in query_params["query"]:
        if "must" in query_params["query"]["bool"]:
            if isinstance(query_params["query"]["bool"]["must"], list):
                query_params["query"]["bool"]["must"].append(
                    restriction_clause
                )
            else:
                must_term = query_params["query"]["bool"]["must"]
                query_params["query"]["bool"] = {
                    "must": [restriction_clause, must_term]
                }
        else:
            query_params["query"]["bool"]["must"] = [restriction_clause]

    return query_params


def restrict_query_params_for_username(
    query_params: Dict[str, any],
    username: str,
) -> Generator[Dict, None, None]:
    return restrict_query_params(
        query_params, restriction_clause={"term": {"added_by": username}}
    )


def restrict_query_params_for_categories(
    query_params: Dict[str, any],
    category_ids: List[int],
    username: str,
) -> Generator[Dict, None, None]:
    categories_restriction = {
        "nested": {
            "path": "category_path",
            "query": {"terms": {"category_path.category_id": category_ids}},
        }
    }
    username_restriction = {"term": {"added_by": username}}
    return restrict_query_params(
        query_params,
        restriction_clause={
            "bool": {
                "should": [
                    categories_restriction,
                    username_restriction,
                ],
                "minimum_should_match": 1,
            }
        },
    )
