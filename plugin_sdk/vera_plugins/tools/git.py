from pathlib import Path
from subprocess import PIPE, CalledProcessError, run

from ..definitions import GitCloneError


def clone_git_repo(
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
    if not target_dir.is_dir():
        raise NotADirectoryError(
            f"Path '{target_dir}' is not a directory "
            f"in the repository '{repo_url}'."
        )

    return target_dir
