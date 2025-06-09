from pathlib import Path
from typing import List, Tuple, Type, TypeVar

import yaml
from pydantic import BaseModel, ValidationError

from ..definitions import ParseConfigError

T = TypeVar("T", bound=BaseModel)


def parse_yaml_config_file(
    path: Path, model: Type[T]
) -> Tuple[List[T], List[ParseConfigError]]:
    items: List[T] = []
    errors: List[ParseConfigError] = []

    try:
        with open(path, "r") as f:
            for item in yaml.safe_load_all(f):
                try:
                    items.append(model.model_validate(item))
                except ValidationError as e:
                    errors.append(e)
    except (FileNotFoundError, OSError, yaml.YAMLError) as e:
        errors.append((e, path))

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
    if "@" not in url:
        return url, None, None

    base_url, rest = url.split("@", 1)

    if ":" not in rest:
        return base_url, rest, None

    branch, subdir = rest.split(":", 1)
    return base_url, branch, subdir
