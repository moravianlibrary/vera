import shutil
import tempfile
from os import walk
from pathlib import Path
from re import Pattern
from typing import List, Type, TypeVar

from pydantic import BaseModel

from ..definitions import (
    PLUGIN_INSTANCES_PATTERN,
    PLUGIN_META_PATTERN,
    GitCloneError,
)
from ..schemas import (
    DiscoveryResult,
    InstanceDiscoveryResult,
    MetaDiscoveryResult,
    PluginInstance,
    PluginMeta,
)
from .git import clone_git_repo
from .parser import parse_git_http_url, parse_yaml_config_file

T = TypeVar("T", bound=BaseModel)


def _discover_in_dir(
    dir: Path, model: Type[T], file_name_pattern: Pattern
) -> List[DiscoveryResult]:
    if not dir.exists():
        raise FileNotFoundError(f"Path {dir} does not exist.")
    if not dir.is_dir():
        raise NotADirectoryError(f"Path {dir} is not a directory.")

    results: List[DiscoveryResult] = []

    for root, _, files in walk(dir):
        for file_name in files:
            if not file_name_pattern.match(file_name):
                continue

            file_path = Path(root) / file_name

            items, errors = parse_yaml_config_file(file_path, model)
            results.extend((file_path, item, None) for item in items)
            results.extend((file_path, None, error) for error in errors)

    return results


def _discover_in_git_http(
    url: str, model: Type[T], file_name_pattern: Pattern
) -> List[DiscoveryResult]:
    repo_url, branch, subdir = parse_git_http_url(url)
    tmp_dir = Path(tempfile.mkdtemp())

    try:
        target_dir = clone_git_repo(tmp_dir, repo_url, branch, subdir)
        plugins_config = _discover_in_dir(target_dir, model, file_name_pattern)
    finally:
        shutil.rmtree(tmp_dir)

    return plugins_config


def _discover_in_location(
    location: str,
    model: Type[T],
    file_name_pattern: Pattern,
) -> List[DiscoveryResult]:
    try:
        return (
            _discover_in_git_http(location, model, file_name_pattern)
            if location.startswith("http://")
            or location.startswith("https://")
            else _discover_in_dir(Path(location), model, file_name_pattern)
        )
    except (GitCloneError, FileNotFoundError, NotADirectoryError) as e:
        return [DiscoveryResult(Path(location), None, e)]


def discover_plugins(
    location: str, plugin_name: str | None = None
) -> List[MetaDiscoveryResult]:
    metas = _discover_in_location(location, PluginMeta, PLUGIN_META_PATTERN)

    return (
        [m for m in metas if m.item and m.item.name == plugin_name]
        if plugin_name
        else metas
    )


def discover_plugin_instances(
    location: str, plugin_name: str
) -> List[InstanceDiscoveryResult]:
    instances = _discover_in_location(
        location, PluginInstance, PLUGIN_INSTANCES_PATTERN
    )

    return (
        [i for i in instances if i.item and i.item.plugin_name == plugin_name]
        if plugin_name
        else instances
    )
