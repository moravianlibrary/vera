import re


def snakify(s: str) -> str:
    s = re.sub(r"[-\s]+", "_", s)
    s = re.sub(r"(?<!^)(?=[A-Z])", "_", s)
    return s.lower()


def parse_str_or_none(value: str) -> str | None:
    return value if value != "None" else None
