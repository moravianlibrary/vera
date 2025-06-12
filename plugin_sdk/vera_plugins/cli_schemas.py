from pathlib import Path
from typing import List

from pydantic import BaseModel

from .definitions.exceptions import DiscoveryError, LintingError
from .schemas import PluginInstance, PluginMeta


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

    def __repr__(self):
        return (
            f"[PluginMeta] Path: {self.path} | "
            f"Name: {self.name or '-'} | "
            f"Type: {self.type or '-'} | "
            f"Version: {self.version or '-'} | "
            f"Author: {self.author or '-'}"
        )


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

    def __repr__(self):
        return (
            f"[PluginInstance] Path: {self.path} | "
            f"Plugin: {self.plugin_name or '-'} | "
            f"Instance: {self.instance_name or '-'}"
        )


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

    def __repr__(self):
        base = super().__repr__()
        if self.error:
            return f"{base}\n  [X] {self.error}"
        return f"{base}\n  [✓] OK"


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

    def __repr__(self):
        base = super().__repr__()
        if self.error:
            return f"{base}\n  [X] {self.error}"
        return f"{base}\n  [✓] OK"


class LintingMetaRow(BaseMetaRow):
    errors: List[str]

    @classmethod
    def from_discovery(
        cls, path: Path, meta: PluginMeta | None, errors: List[LintingError]
    ):
        row = super().from_discovery(path, meta)
        row.errors = [str(err) for err in errors if err]
        return row

    def __repr__(self):
        base = super().__repr__()
        if self.errors:
            formatted_errors = "\n".join(
                [f"  [X] {err}" for err in self.errors]
            )
            return f"{base}\n{formatted_errors}"
        return f"{base}\n  [✓] OK"


class LintingInstanceRow(BaseInstanceRow):
    error: str | None = None

    @classmethod
    def from_discovery(
        cls,
        path: Path,
        instance: PluginInstance | None,
        err: LintingError | None,
    ):
        row = super().from_discovery(path, instance, None)
        row.error = str(err) if err else None
        return row

    def __repr__(self):
        base = super().__repr__()
        if self.error:
            return f"{base}\n  [X] {self.error}"
        return f"{base}\n  [✓] Ok"
