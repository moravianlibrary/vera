import tempfile
from pathlib import Path
from textwrap import dedent
from unittest import TestCase

from pydantic import BaseModel, ValidationError

from vera_plugins.tools.parser import (
    parse_git_http_url,
    parse_yaml_config_file,
)


class TestPluginValidator(TestCase):
    pass
