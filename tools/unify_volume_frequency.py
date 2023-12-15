import re
import sys


YEARLY = r"^(\d{1,3})(-\d{1,3})?\s?(:?x|×|čísla)\s?ročně"
YEARLY_ATYPICAL = r"^Aktualizováno\s(\d{1,3})x\sročně"
YEAR_BOOK = r"^(Ročenka|ročenka|Ročně|Annual|Aktualizováno\sročně|" \
    r"Aktualizováno\s1x\sza\sdva\sroky)"
ONCE_IN_N_YEARS = r"^((Vychází\s)?(1x|jednou).*(roky|let|ročně)|" \
    r"Biennial|Triennial)"
TWICE_A_YEAR = r"^(Semiannual)"
QUARTERLY = r"^(Aktualizováno\sčtvrtletně)"

BIMONTHLY = r"^(Bimonthly|1x\sza\sdva\směsíce)"
MONTHLY = r"^(jednou\směsíčně)"
ONCE_A_MONTH = r"^(měsíčník|Měsíčník|Monthly|monthly)"
N_TIMES_IN_MONTH = r"^(\d{1,3})\s?(x|×)\s(měsíčně|mesíčně)"
ONCE_IN_N_MONTHS = r"^1x\sza\s(\d)\směsíce"

BIWEEKLY = r"^(jednou\sza\sdva\stýdny|Biweekly|čtrnáctideník|čtrnáctidenník|" \
    r"1x\sza\s14\sdní|1x\sza\s2\stýdny)"
WEEKLY = r"^(Týdeník|týdeník|týdně|jednou\stýdně)"
N_TIMES_IN_WEEK = r"^(\d{1,3})\s?(x|×)\stýdně"

DAILY = r"^(Deník|deník|denně|Denně)$"
DAILY_EXCEPT = r"^(denně|Denně)\s(mimo|kromě)"
DAY_OF_WEEK = r"každý\spátek"
N_TIMES_IN_DAY = r"^(\d{1,3})\s?(x|×)\sdenně"

NON_REGULAR = r"^(Vychází\snepravidelně|Různá\speriodicita|[Nn]epravidelně|" \
    r"Completely\sirregular|Aktualizováno\s(nepravidelně|průběžně))"
UNKNOWN = r"^(Unknown|" \
    r"Periodicita\s(neuvedena|není\s(známa|zjištěna)|je\sneurčitelná)|" \
    r"Neznámo|Není\sznáma|No\sissue\sfrequency\sfound)"


def parse_freq(freq):
    match = re.match(YEARLY, freq)
    if match:
        return match.group(1)

    match = re.match(YEARLY_ATYPICAL, freq)
    if match:
        return match.group(1)

    match = re.match(TWICE_A_YEAR, freq)
    if match:
        return 2

    match = re.match(QUARTERLY, freq)
    if match:
        return 4

    match = re.match(YEAR_BOOK, freq)
    if match:
        return 1

    match = re.match(ONCE_IN_N_YEARS, freq)
    if match:
        return 1

    match = re.match(BIMONTHLY, freq)
    if match:
        return 6

    match = re.match(MONTHLY, freq)
    if match:
        return 12

    match = re.match(N_TIMES_IN_MONTH, freq)
    if match:
        return int(match.group(1)) * 12

    match = re.match(ONCE_IN_N_MONTHS, freq)
    if match:
        return 12 // int(match.group(1))

    match = re.match(ONCE_A_MONTH, freq)
    if match:
        return 12

    match = re.match(BIWEEKLY, freq)
    if match:
        return 26

    match = re.match(WEEKLY, freq)
    if match:
        return 52

    match = re.match(N_TIMES_IN_WEEK, freq)
    if match:
        return int(match.group(1)) * 52

    match = re.match(DAILY, freq)
    if match:
        return 365

    match = re.match(DAILY_EXCEPT, freq)
    if match:
        return 313

    match = re.match(DAY_OF_WEEK, freq)
    if match:
        return 52

    match = re.match(N_TIMES_IN_DAY, freq)
    if match:
        return int(match.group(1)) * 365

    match = re.match(NON_REGULAR, freq)
    if match:
        return 0

    match = re.match(UNKNOWN, freq)
    if match:
        return 0

    return freq


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) != 1:
        print("Please provide frequencies file.")
        exit(1)
    with open(args[0], "r") as input:
        for freq in input.readlines():
            print(parse_freq(freq.strip()))
