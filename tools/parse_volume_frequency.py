import requests
from lxml import etree
import re
import sys


K7_HOST = "https://api.kramerius.mzk.cz/search"
GET_MODS_ENDPOINT = "{K7_HOST}/api/client/v7.0/items/{pid}/metadata/mods"
NS_MODS = {'mods': 'http://www.loc.gov/mods/v3'}

VOLUME_YEAR = "^(\\d{4})$"
VOLUME_RANGE = "^(\\d{4})-(\\d{4})$"

RANGE_YEARS_1 = r"^(.*),?\s(?:\d{1,2}\.\s?){2}\[?(\d{4})\]?\s?-\s?" \
    r"(?:\d{1,2}\.\s?){0,2}\s?(\d{4})\??$"
RANGE_YEARS_2 = r"^(.*),?\s(?:\d{1,2}\.\s?)\[?(\d{4})\]?\s?-\s?" \
    r"(?:\d{1,2}\.\s?){0,2}\s?(\d{4})\??$"
RANGE_YEARS_3 = r"^(.*),?\s\[?(\d{4})\]?\s?-" \
    r"\s?(?:\d{1,2}\.\s?){0,2}\s?(\d{4})\??$"
RANGE_YEARS_4 = r"^(.*),?\s\[?(\d{4})\]?-(\d{2})\??$"

FROM_YEAR_1 = r"^(.*),?\s(?:\d{1,2}\.\s?){2}(\d{4})\s?-$"
FROM_YEAR_2 = r"^(.*),?\s(?:\d{1,2}\.\s?)(\d{4})\s?-$"
FROM_YEAR_3 = r"^(.*),?\s(?:od\sr\.\s?)(\d{4})\s?-?$"
FROM_YEAR_4 = r"^(.*),?\s(\d{4})\s?-$"
FROM_YEAR_5 = r"^(?:[Oo]d\s)(?:r\.\s?)?(\d{4})\s?-?\s(.*)$"
FROM_YEAR_6 = r"^(?:[Oo]d\s)(?:\d{1,2}\.\s?){1,2}(\d{4})\s?-?(.*)$"
FROM_YEAR_7 = r"^(.*)\s[Oo]d\s(?:ro)?č\.\s?\d{1,3}\s?\(?(\d{4})(?:-\d{2})?\)?$"
FROM_YEAR_8 = r"^(.*)\s[Oo]d\s(?:\[.*\])?\s?" \
    r"(?:\d{1,2}\.\s?){0,2}\(?(\d{4})(?:-\d{2})?\)?$"

TO_YEAR_1 = r"^(.*),?\s(?:do\sr\.\s?)(\d{4})\s?-?$"
TO_YEAR_2 = r"^(.*),?\sdo\s(?:\d{1,2}\.\s?){0,2}(\d{4})\s?-?$"
TO_YEAR_3 = r"^(.*),?\s[Dd]o\s(?:ro)?č\.\s?\d{1,3}\s?\(?(\d{4})(?:-\d{2})?\)?$"

SINGLE_YEAR = r"^(.*)\s(\d{4})$"


def parse_frequency_for_year(volume_year, issue_frequencies):
    matched = []
    for issue_frequency in issue_frequencies:
        match = re.match(RANGE_YEARS_1, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(2) <= volume_year and volume_year <= match.group(3):
                return match.group(1)

        match = re.match(RANGE_YEARS_2, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(2) <= volume_year and volume_year <= match.group(3):
                return match.group(1)

        match = re.match(RANGE_YEARS_3, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(2) <= volume_year and volume_year <= match.group(3):
                return match.group(1)

        match = re.match(RANGE_YEARS_4, issue_frequency)
        if match:
            matched.append(issue_frequency)
            from_year = match.group(2)
            to_year = from_year[:2] + match.group(3)
            if from_year <= volume_year and volume_year <= to_year:
                return match.group(1)

        match = re.match(FROM_YEAR_1, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(2) <= volume_year:
                return match.group(1)

        match = re.match(FROM_YEAR_2, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(2) <= volume_year:
                return match.group(1)

        match = re.match(FROM_YEAR_3, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(2) <= volume_year:
                return match.group(1)

        match = re.match(FROM_YEAR_4, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(2) <= volume_year:
                return match.group(1)

        match = re.match(FROM_YEAR_5, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(1) <= volume_year:
                return match.group(2)

        match = re.match(FROM_YEAR_6, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(1) <= volume_year:
                return match.group(2)

        match = re.match(FROM_YEAR_7, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(2) <= volume_year:
                return match.group(1)

        match = re.match(FROM_YEAR_8, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(2) <= volume_year:
                return match.group(1)

        match = re.match(TO_YEAR_1, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if volume_year <= match.group(2):
                return match.group(1)

        match = re.match(TO_YEAR_2, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if volume_year <= match.group(2):
                return match.group(1)

        match = re.match(TO_YEAR_3, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if volume_year <= match.group(2):
                return match.group(1)

        match = re.match(SINGLE_YEAR, issue_frequency)
        if match:
            matched.append(issue_frequency)
            if match.group(2) == volume_year:
                return match.group(1)

    return next((freq for freq in issue_frequencies
                 if freq not in matched), None)


def parse_frequency(volume_year, issue_frequencies):
    match = re.match(VOLUME_RANGE, volume_year)
    if match:
        result = parse_frequency_for_year(match.group(1), issue_frequencies)
        if result is not None:
            return result

    match = re.match(VOLUME_YEAR, volume_year)
    if match:
        result = parse_frequency_for_year(volume_year, issue_frequencies)
        if result is not None:
            return result

    return "No issue frequency found"


def get_frequencies(root_pid):
    call = GET_MODS_ENDPOINT.format(K7_HOST=K7_HOST, pid=root_pid)
    response = requests.get(call)

    if response.status_code == 200:
        tree = etree.fromstring(response.content)
        frequency_elements = tree.xpath(
            '//mods:frequency/text()', namespaces=NS_MODS)
        return [item for freq in frequency_elements
                for item in freq.strip().split(';')]


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) != 2:
        print("Please provide the root pid and the volume issued year.")
    else:
        root_pid = args[0]
        volume_year = args[1]
        frequencies = get_frequencies(root_pid)
        result = parse_frequency(volume_year, frequencies)
        print(f"{frequencies}|{volume_year}|{result}")
