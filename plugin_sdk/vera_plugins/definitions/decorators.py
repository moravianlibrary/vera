from .plugin_types import PluginType


def patch_plugin(plugin_type: PluginType):
    def decorator(fn):
        fn.__is_plugin_test__ = True
        fn.__plugin_type__ = plugin_type
        return fn

    return decorator
