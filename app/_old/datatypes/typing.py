from typing import Any, AnyStr, Dict, Tuple

JsonBase = Dict[AnyStr, Any]
IdType = str | int
ElasticsearchParams = JsonBase
# TODO: make it work
# EsRoutingParams = Dict[str, str | Tuple[int, int]]
EsRoutingParams = JsonBase
