import io
import zipfile
from pathlib import Path
from typing import List


def package_plugin(base_path: Path, include_files: List[str]) -> bytes:
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
