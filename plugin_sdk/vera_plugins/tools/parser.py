from pathlib import Path
from typing import List, Tuple

import yaml

from ..schemas import PluginsConfig


def parse_veraplugin_yaml(path: Path) -> PluginsConfig:
    plugins_config = None
    with open(path, "r") as f:
        plugins_config = PluginsConfig.model_validate(yaml.safe_load(f))

    if plugins_config.plugins is None and plugins_config.instances is None:
        raise ValueError(f"Empty plugins config in {path}")

    return plugins_config


def parse_requirements(path: Path) -> List[str]:
    requirements = []

    with open(path, "r") as f:
        for line in f:
            line = line.strip()

            if not line:
                continue
            if line.startswith("#"):
                continue
            if line.startswith("-r"):
                requirements.extend(
                    parse_requirements(path.parent / line[3:].strip())
                )

            requirements.append(line)

    return requirements


def parse_git_http_url(url: str) -> Tuple[str, str | None, str | None]:
    """
    Parses git url that can have optional '@branch'
    and optional ':subdir' suffix.

    Examples:
    - https://github.com/user/repo.git
    - https://github.com/user/repo.git@develop
    - https://github.com/user/repo.git@develop:plugins/special
    """
    if "@" not in url:
        return url, None, None

    base_url, rest = url.split("@", 1)

    if ":" not in rest:
        return base_url, rest, None

    branch, subdir = rest.split(":", 1)
    return base_url, branch, subdir
