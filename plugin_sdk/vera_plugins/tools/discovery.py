import shutil
import tempfile
from os import walk
from pathlib import Path
from subprocess import PIPE, CalledProcessError, run

from ..definitions import PLUGIN_META_FILENAMES, GitCloneError
from ..schemas import PluginsConfig
from .parser import parse_git_http_url, parse_veraplugin_yaml


def discover_plugins_from_dir(dir: Path) -> PluginsConfig:
    aggregated_config = PluginsConfig(plugins=[], instances=[])

    for root, _, files in walk(dir):
        for file_name in files:
            if file_name not in PLUGIN_META_FILENAMES:
                continue

            config_path = Path(root) / file_name
            parsed_config = parse_veraplugin_yaml(config_path)

            if parsed_config.plugins:
                aggregated_config.plugins.extend(parsed_config.plugins)
            if parsed_config.instances:
                aggregated_config.instances.extend(parsed_config.instances)

    return aggregated_config


def _clone_git_repo(
    target_dir: Path,
    repo_url: str,
    branch: str | None = None,
    subdir: str | None = None,
) -> Path:

    clone_cmd = ["git", "clone", "--depth", "1"]
    if branch:
        clone_cmd += ["--branch", branch]
    clone_cmd += [repo_url, str(target_dir)]

    try:
        run(clone_cmd, check=True, stdout=PIPE, stderr=PIPE, text=True)
    except CalledProcessError as e:
        raise GitCloneError(clone_cmd, e) from e

    if not subdir:
        return target_dir

    target_dir = target_dir / subdir

    if not target_dir.exists():
        raise FileNotFoundError(
            f"Subdirectory '{subdir}' not found "
            f"in the repository '{repo_url}'."
        )

    return target_dir


def discover_plugins_from_git_http(url: str) -> PluginsConfig:
    repo_url, branch, subdir = parse_git_http_url(url)
    tmp_dir = Path(tempfile.mkdtemp())

    try:
        target_dir = _clone_git_repo(tmp_dir, repo_url, branch, subdir)
        plugins_config = discover_plugins_from_dir(target_dir)
    finally:
        shutil.rmtree(tmp_dir)

    return plugins_config
