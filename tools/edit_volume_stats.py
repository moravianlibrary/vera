import sys
# from parse_volume_frequency import get_frequencies, parse_frequency


def report(file):
    valid = []
    multiple_publishers = []
    multiple_languages = []
    multiple_places = []

    with open(file, "r") as input:
        for line in input.readlines():
            values = line.split("||")
            if len(values) == 2:
                continue
            if "|" in values[3]:
                multiple_publishers.append(line)
            if "|" in values[4]:
                multiple_languages.append(line)
            if "|" in values[5]:
                multiple_places.append(line)
            if ("|" not in values[3]
                    and "|" not in values[4]
                    and "|" not in values[5]):
                valid.append(line)

    print(f"valid: {len(valid)}")
    print(f"multiple publishers: {len(multiple_publishers)}")
    print(f"multiple languages: {len(multiple_languages)}")
    print(f"multiple places: {len(multiple_places)}")


def ignore_xr_report(file):
    valid = []
    multiple_publishers = []
    multiple_languages = []
    multiple_places = []

    with open(file, "r") as input:
        for line in input.readlines():
            values = line.split("||")
            if len(values) == 2:
                continue
            places = values[5].split("|")
            if "|" in values[3]:
                multiple_publishers.append(line)
            if "|" in values[4]:
                multiple_languages.append(line)
            if "xr" not in places and len(places) >= 2:
                multiple_places.append(line)
            if ("|" not in values[3]
                    and "|" not in values[4]
                    and (len(places) == 1 or len(places) == 2
                         and "xr" in places)):
                valid.append(line)

    print(f"valid: {len(valid)}")
    print(f"multiple publishers: {len(multiple_publishers)}")
    print(f"multiple languages: {len(multiple_languages)}")
    print(f"multiple places: {len(multiple_places)}")
    for line in multiple_places:
        print(line)


def take_first_ignore_xr_add_freq(file):
    with open(file, "r") as input:
        for line in input.readlines():
            values = line.split("||")
            if len(values) == 2:
                continue

            publishers = values[3].split("|")
            languages = values[4].split("|")
            places = values[5].split("|")
            place = "xr"
            for p in places:
                if p != "xr":
                    place = p
                    break

            pid, title, year = values[:3]
            publisher = publishers[0]
            language = languages[0]
            pages_count = values[6].replace("\n", "")

            print(f"{pid}|{title}|{year}|{publisher}|{language}|{place}"
                  f"|{pages_count}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) != 1:
        print("Please provide volumes stats file.")
        exit(1)

    # report(args[0])
    # ignore_xr_report(args[0])
    take_first_ignore_xr_add_freq(args[0])
