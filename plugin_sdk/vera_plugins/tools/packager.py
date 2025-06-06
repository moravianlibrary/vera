import io
import tempfile
import zipfile
from pathlib import Path
from typing import List


def package_plugin(base_path: Path, include_files: List[str]) -> bytes:
    """
    Package specified files from a base directory into a ZIP archive as bytes.

    Parameters
    ----------
    base_path : Path
        The base directory containing the plugin files to be packaged.
    include_files : List[str]
        List of relative file paths (relative to `base_path`) to include in the
        package.

    Returns
    -------
    bytes
        The ZIP archive containing the specified files, represented as bytes.

    Raises
    ------
    FileNotFoundError
        If any file in `include_files` does not exist or is not a file under
        `base_path`.
    """
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, mode="w") as zf:
        for relative_file in include_files:
            file_path = base_path / relative_file
            if not file_path.exists() or not file_path.is_file():
                raise FileNotFoundError(
                    f"File '{relative_file}' does not exist "
                    f"under '{base_path}'."
                )

            zf.write(file_path, arcname=relative_file)

    zip_buffer.seek(0)

    return zip_buffer.getvalue()


def unpack_plugin(plugin_name: str, plugin_package: bytes) -> Path:
    """
    Unpack a plugin ZIP archive (given as bytes) into a temporary directory.

    Parameters
    ----------
    plugin_name : str
        The name of the plugin, used as a prefix for the temporary directory.
    plugin_package : bytes
        The ZIP archive containing the plugin files, as bytes.

    Returns
    -------
    Path
        The path to the temporary directory where the plugin was unpacked.
    """
    temp_dir = tempfile.mkdtemp(prefix=f"plugin_{plugin_name}_")
    with zipfile.ZipFile(io.BytesIO(plugin_package)) as zip_ref:
        zip_ref.extractall(temp_dir)
    return Path(temp_dir)
