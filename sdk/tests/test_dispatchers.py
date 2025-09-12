import unittest

from vera_plugins.definitions.plugin_types import PluginType


class TestSkeletonDispatcher(unittest.TestCase):
    def test_dispatch(self):
        from vera_plugins.dispatchers import (
            PLUGIN_TYPE_SKELETON,
            get_plugin_type_skeleton,
        )

        for plugin_type in PluginType:
            self.assertIn(plugin_type, PLUGIN_TYPE_SKELETON)

        skeleton = get_plugin_type_skeleton(
            PluginType.IdentityProvider, "TestIdentityProvider"
        )
        self.assertIn("TestIdentityProvider", skeleton)
