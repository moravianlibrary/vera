import re
from typing import List


VOLUME_YEAR = "^(\\d{4})$"
VOLUME_RANGE = "^(\\d{4})-(\\d{4})$"

RANGE_YEARS_1 = (
    r"^(.*)\s(?:\d{1,2}\.\s?){2}\[?(\d{4})\]?\s?-\s?"
    r"(?:\d{1,2}\.\s?){0,2}\s?(\d{4})$"
)
RANGE_YEARS_2 = (
    r"^(.*)\s(?:\d{1,2}\.\s?)\[?(\d{4})\]?\s?-\s?"
    r"(?:\d{1,2}\.\s?){0,2}\s?(\d{4})$"
)
RANGE_YEARS_3 = (
    r"^(.*)\s\[?(\d{4})\]?\s?-" r"\s?(?:\d{1,2}\.\s?){0,2}\s?(\d{4})$"
)
RANGE_YEARS_4 = r"^(.*)\s\[?(\d{4})\]?-(\d{2})$"

FROM_YEAR_1 = r"^(.*)\s(?:\d{1,2}\.\s?){2}(\d{4})\s?-$"
FROM_YEAR_2 = r"^(.*)\s(?:\d{1,2}\.\s?)(\d{4})\s?-$"
FROM_YEAR_3 = r"^(.*)\s(?:od\sr\.\s?)(\d{4})\s?-?$"
FROM_YEAR_4 = r"^(.*)\s(\d{4})\s?-$"
FROM_YEAR_5 = r"^(?:[Oo]d\s)(?:r\.\s?)?(\d{4})\s?-?\s(.*)$"
FROM_YEAR_6 = r"^(?:[Oo]d\s)(?:\d{1,2}\.\s?){1,2}(\d{4})\s?-?(.*)$"
FROM_YEAR_7 = r"^(.*)\s[Oo]d\s(?:ro)?č\.\s?\d{1,3}\s?\(?(\d{4})(?:-\d{2})?\)?$"
FROM_YEAR_8 = (
    r"^(.*)\s[Oo]d\s(?:\[.*\])?\s?"
    r"(?:\d{1,2}\.\s?){0,2}\(?(\d{4})(?:-\d{2})?\)?$"
)

TO_YEAR_1 = r"^(.*)\s(?:do\sr\.\s?)(\d{4})\s?-?$"
TO_YEAR_2 = r"^(.*)\sdo\s(?:\d{1,2}\.\s?){0,2}(\d{4})\s?-?$"
TO_YEAR_3 = r"^(.*)\s[Dd]o\s(?:ro)?č\.\s?\d{1,3}\s?\(?(\d{4})(?:-\d{2})?\)?$"

SINGLE_YEAR = r"^(.*)\s(\d{4})$"


YEARLY = r"^(\d{1,3})(-\d{1,3})?\s?(:?x|×|čísla)\s?ročně"
YEARLY_ATYPICAL = r"^Aktualizováno\s(\d{1,3})x\sročně"
YEAR_BOOK = (
    r"^(Ročenka|ročenka|Ročně|Annual|Aktualizováno\sročně|"
    r"Aktualizováno\s1x\sza\sdva\sroky)"
)
ONCE_IN_N_YEARS = (
    r"^((Vychází\s)?(1x|jednou).*(roky|let|ročně)|" r"Biennial|Triennial)"
)
TWICE_A_YEAR = r"^(Semiannual)"
QUARTERLY = r"^(Aktualizováno\sčtvrtletně)"

BIMONTHLY = r"^(Bimonthly|1x\sza\sdva\směsíce)"
MONTHLY = r"^(jednou\směsíčně)"
ONCE_A_MONTH = r"^(měsíčník|Měsíčník|Monthly|monthly)"
N_TIMES_IN_MONTH = r"^(\d{1,3})\s?(x|×)\s(měsíčně|mesíčně)"
ONCE_IN_N_MONTHS = r"^1x\sza\s(\d)\směsíce"

BIWEEKLY = (
    r"^(jednou\sza\sdva\stýdny|Biweekly|čtrnáctideník|čtrnáctidenník|"
    r"1x\sza\s14\sdní|1x\sza\s2\stýdny)"
)
WEEKLY = r"^(Týdeník|týdeník|týdně|jednou\stýdně)"
N_TIMES_IN_WEEK = r"^(\d{1,3})\s?(x|×)\stýdně"

DAILY = r"^(Deník|deník|denně|Denně)$"
DAILY_EXCEPT = r"^(denně|Denně)\s(mimo|kromě)"
DAY_OF_WEEK = r"každý\spátek"
N_TIMES_IN_DAY = r"^(\d{1,3})\s?(x|×)\sdenně"

NON_REGULAR = (
    r"^(Vychází\snepravidelně|Různá\speriodicita|[Nn]epravidelně|"
    r"Completely\sirregular|Aktualizováno\s(nepravidelně|průběžně))"
)
UNKNOWN = (
    r"^(Unknown|"
    r"Periodicita\s(neuvedena|není\s(známa|zjištěna)|je\sneurčitelná)|"
    r"Neznámo|Není\sznáma|No\sissue\sfrequency\sfound)"
)


def parse_year(year_issued: str) -> int:
    match = re.match(VOLUME_RANGE, year_issued)
    if match:
        return int(match.group(1))
    match = re.match(VOLUME_YEAR, year_issued)
    if match:
        return int(year_issued)
    raise ValueError("Could not parse publishing year.")


def parse_frequency(year_issued: str, frequencies: List[str]) -> int:
    match = re.match(VOLUME_RANGE, year_issued)
    if match:
        result = parse_frequency_for_year(match.group(1), frequencies)
        if result is not None:
            return parse_frequency_to_x(result)

    match = re.match(VOLUME_YEAR, year_issued)
    if match:
        result = parse_frequency_for_year(year_issued, frequencies)
        if result is not None:
            return parse_frequency_to_x(result)

    return 0


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

    return next(
        (freq for freq in issue_frequencies if freq not in matched), None
    )


def parse_frequency_to_x(frequency):
    match = re.match(YEARLY, frequency)
    if match:
        return match.group(1)

    match = re.match(YEARLY_ATYPICAL, frequency)
    if match:
        return match.group(1)

    match = re.match(TWICE_A_YEAR, frequency)
    if match:
        return 2

    match = re.match(QUARTERLY, frequency)
    if match:
        return 4

    match = re.match(YEAR_BOOK, frequency)
    if match:
        return 1

    match = re.match(ONCE_IN_N_YEARS, frequency)
    if match:
        return 1

    match = re.match(BIMONTHLY, frequency)
    if match:
        return 6

    match = re.match(MONTHLY, frequency)
    if match:
        return 12

    match = re.match(N_TIMES_IN_MONTH, frequency)
    if match:
        return int(match.group(1)) * 12

    match = re.match(ONCE_IN_N_MONTHS, frequency)
    if match:
        return 12 // int(match.group(1))

    match = re.match(ONCE_A_MONTH, frequency)
    if match:
        return 12

    match = re.match(BIWEEKLY, frequency)
    if match:
        return 26

    match = re.match(WEEKLY, frequency)
    if match:
        return 52

    match = re.match(N_TIMES_IN_WEEK, frequency)
    if match:
        return int(match.group(1)) * 52

    match = re.match(DAILY, frequency)
    if match:
        return 365

    match = re.match(DAILY_EXCEPT, frequency)
    if match:
        return 313

    match = re.match(DAY_OF_WEEK, frequency)
    if match:
        return 52

    match = re.match(N_TIMES_IN_DAY, frequency)
    if match:
        return int(match.group(1)) * 365

    match = re.match(NON_REGULAR, frequency)
    if match:
        return 0

    match = re.match(UNKNOWN, frequency)
    if match:
        return 0

    return frequency
