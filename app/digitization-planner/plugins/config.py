from typing import Dict, List

from pydantic import BaseModel

PluginCode = str


class PluginConfig(BaseModel):
    plugin_code: PluginCode
    python_version: str
    requirements: List[str]
    config: Dict[str, str] | None = None
