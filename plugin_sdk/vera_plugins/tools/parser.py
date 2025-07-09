from pathlib import Path
from typing import List, Tuple, Type

import yaml
from pydantic import ValidationError

from ..definitions.exceptions import ParseConfigError
from ..definitions.patterns import GIT_HTTP_URL_PATTERN
from ..schemas import ConfigTypeAdapter, PluginModelType


def parse_yaml_config_file(
    path: Path, model: Type[PluginModelType]
) -> Tuple[List[PluginModelType], List[ParseConfigError]]:
    items: List[PluginModelType] = []
    errors: List[ParseConfigError] = []

    try:
        with open(path, "r") as f:
            for item in yaml.safe_load_all(f):
                try:
                    if model is ConfigTypeAdapter:
                        items.append(model.validate_python(item))
                    else:
                        items.append(model.model_validate(item))
                except ValidationError as e:
                    errors.append(e)
    except (FileNotFoundError, OSError, yaml.YAMLError) as e:
        errors.append(e)

    return items, errors


def parse_git_http_url(url: str) -> Tuple[str, str | None, str | None]:
    """
    Parses git url that can have optional '@branch'
    and optional ':subdir' suffix.

    Examples:
    - https://github.com/user/repo.git
    - https://github.com/user/repo.git@develop
    - https://github.com/user/repo.git@develop:plugins/special
    """
    match = GIT_HTTP_URL_PATTERN.match(url)

    if not match:
        raise ValueError(
            f"Invalid Git HTTP(S) URL: {url}. Expected format: "
            "'http[s]://<host>/<user>/<repo>.git[@<branch>][:<subdir>]'."
        )

    base_url, branch, subdir = match.groups()
    return base_url, branch, subdir
