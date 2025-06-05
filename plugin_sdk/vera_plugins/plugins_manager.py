from definitions import PluginType
from schemas import PluginInstanceConfig


class PluginsManager:
    def __init__(self, plugins_dir: str | None = None):
        self.plugins = {}

    def _discover_plugins(self, plugins_dir) -> None:
        pass

    def _register_plugin(self):
        pass

    def register_plugin_from_path(self, plugin_dir: str) -> None:
        pass

    def register_plugin_from_http_git(self, http_git_url: str) -> None:
        pass

    def instantiate_plugin(
        self, instance_config: PluginInstanceConfig
    ) -> None:
        pass

    def get_active_plugins(self, plugin_type: PluginType) -> List[str]:
        pass
