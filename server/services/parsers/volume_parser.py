import re
from typing import Optional


VOLUME_REGEX = r"^\s*(\d)(\s.*)?$"

VOLUME_YEAR_SINGLE_REGEX = r"^\s*(\d{4})\s*$"
VOLUME_YEAR_RANGE_REGEX = r"^\s*(\d{4})-(\d{4})?\s*$"

BUNDLE_RANGE_REGEX = r"^\s*(\d)\s*-\s*(\d).*$"
BUNDLE_SINGLE_REGEX = r"^\s*(\d)(\s.*)?$"


def parse_volume(volume: Optional[str]) -> Optional[int]:
    if volume is None:
        return None
    match = re.match(VOLUME_REGEX, volume)
    return int(match.group(1)) if match else None


def parse_volume_year(volume_year: Optional[str]) -> Optional[int]:
    if volume_year is None:
        return None
    match = re.match(VOLUME_YEAR_RANGE_REGEX, volume_year)
    if match:
        return int(match.group(1))
    match = re.match(VOLUME_YEAR_SINGLE_REGEX, volume_year)
    return int(match.group(1)) if match else None


def parse_bundle(bundle: Optional[str]) -> Optional[int]:
    if bundle is None:
        return None
    match = re.match(BUNDLE_RANGE_REGEX, bundle)
    if match:
        return int(match.group(1))
    match = re.match(BUNDLE_SINGLE_REGEX, bundle)
    return int(match.group(1)) if match else None
