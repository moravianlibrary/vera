import tempfile
from pathlib import Path
from textwrap import dedent
from unittest import TestCase

from pydantic import BaseModel, ValidationError

from vera_plugins.tools.parser import (
    parse_git_http_url,
    parse_yaml_config_file,
)


class TestItem(BaseModel):
    name: str
    value: int


class TestParserTool(TestCase):
    def test_parse_yaml_config_file_test(self):
        with tempfile.NamedTemporaryFile(
            "w", suffix=".yaml", delete=False
        ) as temp_file:
            temp_file.write(
                dedent(
                    """
                    name: Test Item
                    value: 42
                    ---
                    name: Test Item 2
                    value: 69
                    """
                )
            )
            temp_file.close()
            temp_file_path = Path(temp_file.name)

        items, errors = parse_yaml_config_file(temp_file_path, TestItem)

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].name, "Test Item")
        self.assertEqual(items[0].value, 42)
        self.assertEqual(items[1].name, "Test Item 2")
        self.assertEqual(items[1].value, 69)
        self.assertEqual(len(errors), 0)

        temp_file_path.unlink()

    def test_parse_yaml_config_file_invalid_test(self):
        with tempfile.NamedTemporaryFile(
            "w", suffix=".yaml", delete=False
        ) as temp_file:
            temp_file.write(
                dedent(
                    """
                    name: Invalid Item
                    value: not_a_number
                    """
                )
            )
            temp_file_path = Path(temp_file.name)

        items, errors = parse_yaml_config_file(temp_file_path, TestItem)

        self.assertEqual(len(items), 0)
        self.assertEqual(len(errors), 1)
        self.assertIsInstance(errors[0], ValidationError)

        temp_file_path.unlink()

    def test_parse_yaml_config_file_empty(self):
        with tempfile.NamedTemporaryFile(
            "w", suffix=".yaml", delete=False
        ) as temp_file:
            temp_file.write("")
            temp_file.close()
            temp_file_path = Path(temp_file.name)

        items, errors = parse_yaml_config_file(temp_file_path, TestItem)

        self.assertEqual(len(items), 0)
        self.assertEqual(len(errors), 0)

        temp_file_path.unlink()

    def test_parse_yaml_config_file_non_existent(self):
        non_existent_path = Path("/non/existent/path.yaml")
        items, errors = parse_yaml_config_file(non_existent_path, TestItem)

        self.assertEqual(len(items), 0)
        self.assertEqual(len(errors), 1)
        self.assertIsInstance(errors[0], FileNotFoundError)

    def test_parse_git_http_url(self):
        url = "https://github.com/user/repo.git"
        base_url, branch, subdir = parse_git_http_url(url)

        self.assertEqual(base_url, "https://github.com/user/repo.git")
        self.assertIsNone(branch)
        self.assertIsNone(subdir)

    def test_parse_git_http_url_with_branch(self):
        url = "https://github.com/user/repo.git@develop"
        base_url, branch, subdir = parse_git_http_url(url)

        self.assertEqual(base_url, "https://github.com/user/repo.git")
        self.assertEqual(branch, "develop")
        self.assertIsNone(subdir)

    def test_parse_git_http_url_with_subdir(self):
        url = "https://github.com/user/repo.git:plugins/special"
        base_url, branch, subdir = parse_git_http_url(url)

        self.assertEqual(base_url, "https://github.com/user/repo.git")
        self.assertIsNone(branch)
        self.assertEqual(subdir, "plugins/special")

    def test_parse_git_http_url_with_branch_and_subdir(self):
        url = "https://github.com/user/repo.git@develop:plugins/special"
        base_url, branch, subdir = parse_git_http_url(url)

        self.assertEqual(base_url, "https://github.com/user/repo.git")
        self.assertEqual(branch, "develop")
        self.assertEqual(subdir, "plugins/special")

    def test_parse_git_http_url_invalid(self):
        for url in [
            "github.com/user/repo.git",
            "https://github.com/user/repo",
            "",
        ]:
            with self.assertRaises(ValueError):
                parse_git_http_url(url)
