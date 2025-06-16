from typing import Dict, List

JsonScalar = str | int | float | bool | None
JsonObject = Dict[str, JsonScalar | "JsonObject" | "JsonArray"]
JsonArray = List[JsonScalar | JsonObject | "JsonArray"]
