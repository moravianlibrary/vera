from pathlib import Path
from typing import List

from pydantic import BaseModel

from .definitions import DiscoveryError, LintingError
from .schemas import PluginInstance, PluginMeta


# TODO: Stringify errors to custom formats
class BaseMetaRow(BaseModel):
    path: str
    name: str | None = None
    type: str | None = None
    version: str | None = None
    author: str | None = None

    @classmethod
    def from_discovery(cls, path: Path, meta: PluginMeta | None):
        row = cls(path=str(path))

        if meta:
            row.name = meta.name
            row.type = meta.type.value
            if meta.version:
                row.version = meta.version
            if meta.author:
                row.author = meta.author

        return row


class BaseInstanceRow(BaseModel):
    path: str
    plugin_name: str | None = None
    instance_name: str | None = None

    @classmethod
    def from_discovery(cls, path: Path, instance: PluginInstance | None):
        row = cls(path=str(path))

        if instance:
            row.plugin_name = instance.plugin_name
            row.instance_name = instance.instance_name

        return row


class DiscoveryMetaRow(BaseMetaRow):
    error: str | None = None

    @classmethod
    def from_discovery(
        cls, path: Path, meta: PluginMeta | None, err: DiscoveryError | None
    ):
        row = super().from_discovery(path, meta)

        if err:
            row.error = str(err)

        return row


class DiscoveryInstanceRow(BaseInstanceRow):
    error: str | None = None

    @classmethod
    def from_discovery(
        cls,
        path: Path,
        instance: PluginInstance | None,
        err: DiscoveryError | None,
    ):
        row = super().from_discovery(path, instance)

        if err:
            row.error = str(err)

        return row


class LintingMetaRow(BaseMetaRow):
    errors: List[LintingError]

    @classmethod
    def from_discovery(
        cls, path: Path, meta: PluginMeta | None, errors: List[LintingError]
    ):
        row = super().from_discovery(path, meta)
        row.errors = errors
        return row


class LintingInstanceRow(BaseInstanceRow):
    error: LintingError | None = None

    @classmethod
    def from_discovery(
        cls,
        path: Path,
        instance: PluginInstance | None,
        err: LintingError | None,
    ):
        row = super().from_discovery(path, instance, None)
        row.error = err
        return row
