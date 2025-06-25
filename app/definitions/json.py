from typing import Dict, List, Union

JsonScalar = str | int | float | bool | None
JsonObject = Dict[str, Union[JsonScalar, "JsonObject", "JsonArray"]]
JsonArray = List[Union[JsonScalar, JsonObject, "JsonArray"]]
