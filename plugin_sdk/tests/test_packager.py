import shutil
import tempfile
from pathlib import Path
from unittest import TestCase

from vera_plugins.tools.packager import package_plugin, unpack_plugin


class TestPluginPackager(TestCase):
    def setUp(self):
        self.test_dir = tempfile.TemporaryDirectory()
        self.base_path = Path(self.test_dir.name)

        (self.base_path / "file1.txt").write_text("Content of file 1")
        (self.base_path / "file2.txt").write_text("Content of file 2")
        (self.base_path / "subdir").mkdir()
        (self.base_path / "subdir" / "file3.txt").write_text(
            "Content of file 3"
        )

    def tearDown(self):
        self.test_dir.cleanup()

    def test_package_and_unpack_success(self):
        additional_files = ["file1.txt", "subdir/file3.txt"]
        package_bytes = package_plugin(self.base_path, additional_files)
        self.assertIsInstance(package_bytes, bytes)
        self.assertTrue(len(package_bytes) > 0)

        unpack_dir = unpack_plugin("testplugin", package_bytes)
        unpack_path = Path(unpack_dir)

        for rel_file in additional_files:
            file_path = unpack_path / rel_file
            self.assertTrue(file_path.exists())
            expected_content = (self.base_path / rel_file).read_text()
            self.assertEqual(file_path.read_text(), expected_content)

        shutil.rmtree(unpack_dir)

    def test_package_missing_file_raises(self):
        additional_files = ["file1.txt", "missing.txt"]
        with self.assertRaises(FileNotFoundError):
            package_plugin(self.base_path, additional_files)

    def test_package_with_directory_included_raises(self):
        additional_files = ["file1.txt", "subdir"]
        with self.assertRaises(FileNotFoundError):
            package_plugin(self.base_path, additional_files)

    def test_unpack_creates_temp_dir(self):
        additional_files = ["file1.txt"]
        package_bytes = package_plugin(self.base_path, additional_files)
        unpack_dir = unpack_plugin("unpacktest", package_bytes)
        self.assertTrue(Path(unpack_dir).exists())
        self.assertTrue(Path(unpack_dir).is_dir())
        shutil.rmtree(unpack_dir)
