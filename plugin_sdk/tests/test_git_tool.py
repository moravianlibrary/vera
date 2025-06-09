import tempfile
from pathlib import Path
from unittest import TestCase, skip

from vera_plugins.tools.git import clone_git_repo

PUBLIC_REPO_URL = "https://github.com/moravianlibrary/aleph-nought.git"
PUBLIC_REPO_SUBDIR = "tests"
PUBLIC_REPO_FILE = "README.md"


@skip("Skipping tests requiring git access.")
class TestPluginDiscovery(TestCase):
    def test_clone_git_repo(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            target_path = clone_git_repo(Path(tmpdir), PUBLIC_REPO_URL)

            self.assertTrue(target_path.exists())
            self.assertTrue(target_path.is_dir())

    def test_clone_git_repo_with_branch(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            target_path = clone_git_repo(
                Path(tmpdir), PUBLIC_REPO_URL, branch="main"
            )

            self.assertTrue(target_path.exists())
            self.assertTrue(target_path.is_dir())

    def test_clone_git_repo_with_subdir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            target_path = clone_git_repo(
                Path(tmpdir),
                PUBLIC_REPO_URL,
                branch="main",
                subdir=PUBLIC_REPO_SUBDIR,
            )

            self.assertTrue(target_path.exists())
            self.assertTrue(target_path.is_dir())

    def test_clone_git_repo_with_invalid_subdir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with self.assertRaises(FileNotFoundError):
                clone_git_repo(
                    Path(tmpdir), PUBLIC_REPO_URL, subdir="non_existent_subdir"
                )

    def test_clone_git_repo_with_non_directory_subdir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with self.assertRaises(NotADirectoryError):
                clone_git_repo(
                    Path(tmpdir), PUBLIC_REPO_URL, subdir=PUBLIC_REPO_FILE
                )

    def test_clone_git_repo_with_invalid_url(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with self.assertRaises(Exception) as context:
                clone_git_repo(Path(tmpdir), "https://invalid.url/repo.git")

            self.assertTrue("git clone" in str(context.exception))
            self.assertTrue(
                "https://invalid.url/repo.git" in str(context.exception)
            )
