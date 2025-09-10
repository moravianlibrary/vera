import os


def remove_file(path: str):
    try:
        os.remove(path)
    except OSError:
        pass
