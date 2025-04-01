from typing import Dict, List

from pydantic import BaseModel

PluginCode = str


class PluginConfig(BaseModel):
    source_url: str | None = None
    plugin_code: PluginCode
    python_version: str
    requirements: List[str]
    config: Dict[str, str] | None = None
