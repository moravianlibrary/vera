import inspect
from importlib import util
from pathlib import Path
from types import ModuleType
from unittest import TestCase

from ..definitions.constants import PLUGIN_TESTS_PATH
from ..definitions.plugin_types import PluginType
from ..schemas import PluginConfig, PluginMeta
from ..tools.registry import PluginRegistry


class PluginTester:
    def __init__(self, tests_dir: Path | None = None):
        self._tests_dir = tests_dir or PLUGIN_TESTS_PATH

        if not self._tests_dir.exists():
            raise FileNotFoundError(
                f"Tests directory {self._tests_dir} does not exist."
            )

        self._test_modules = [
            self._load_test_module(path)
            for path in self._tests_dir.glob("test_*.py")
        ]

    def _load_test_module(self, path: Path) -> ModuleType:
        spec = util.spec_from_file_location(path.stem, path)
        module = util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def __call__(self, meta: PluginMeta, path: Path, config: PluginConfig):
        registry = PluginRegistry()
        registry.register_from_path(meta, path, config)

        for module in self._test_modules:
            for _, cls in inspect.getmembers(module, inspect.isclass):
                if not issubclass(cls, TestCase):
                    continue

                test_instance = cls()
                for method_name, method in inspect.getmembers(
                    cls, predicate=inspect.isfunction
                ):
                    if not getattr(method, "__is_plugin_test__", False):
                        continue

                    plugin_type = getattr(method, "__plugin_type__", None)
                    if (
                        plugin_type is None
                        or PluginType(plugin_type) != meta.type
                    ):
                        continue

                    plugin_instance = (
                        registry._get_singleton_plugin(meta.type)
                        if meta.type
                        in [
                            PluginType.CatalogAdapter,
                            PluginType.DigitizationRegistryAdapter,
                        ]
                        else registry._get_multi_plugin(
                            meta.type, config.instance_name
                        )
                    )

                    getattr(test_instance, method_name)(plugin_instance)
