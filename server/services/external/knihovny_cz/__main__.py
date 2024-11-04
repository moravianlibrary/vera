import sys
import os
import argparse
from .client import KnihovnyCzClient
from .types import KnihovnyCzField


def parse_values(input_source):
    if input_source == "-":
        return [line.strip() for line in sys.stdin]
    elif os.path.isfile(input_source):
        with open(input_source, "r") as f:
            return [line.strip() for line in f]
    else:
        return input_source.split(",")


def main():
    argparser = argparse.ArgumentParser()
    argparser.add_argument(
        "--values",
        nargs="?",
        help="Comma-separated values or path to a file containing values. "
        "Use '-' to read from stdin.",
    )

    args = argparser.parse_args()

    if not args.values:
        print("No values provided.")
        exit(1)

    values = parse_values(args.values)
    client = KnihovnyCzClient()

    for value in values:
        try:
            record = client.get_knihovny_cz_document(
                value, [KnihovnyCzField.PerLibraryIds]
            )
            print(f"{value},{record.skc_sysno}")
        except Exception:
            print(f"{value},mzk_record_not_found")


if __name__ == "__main__":
    main()
