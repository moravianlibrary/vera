from pymarc import MARCReader, MARCWriter
from .client import AlephClient
from .datatypes import AlephField
import argparse


def main():
    argparser = argparse.ArgumentParser()
    argparser.add_argument("--file", help="MARC file to parse and print")
    argparser.add_argument(
        "--field",
        type=AlephField,
        default=AlephField.Sysno,
        help="Aleph field to search for",
    )
    argparser.add_argument(
        "--value",
        help="Value to search for in the Aleph based on the Aleph field",
    )
    argparser.add_argument(
        "--find-by-prefix",
        help="Find records by prefix in the Aleph based on the Aleph field",
    )
    argparser.add_argument(
        "--base",
        help="Base to search in the Aleph based on the Aleph field",
        default="MZK01",
    )
    argparser.add_argument(
        "--output", help="Output file to print the parsed record to"
    )

    args = argparser.parse_args()

    if args.find_by_prefix is not None:
        for sysno in AlephClient().find_all_sysnos(
            args.base, args.field, args.find_by_prefix
        ):
            print(sysno)
        exit(0)

    if args.file is None and args.value is None:
        print("Nothing to do here. Exiting.")
        exit(0)

    record = (
        [r for r in MARCReader(open(args.file, "rb"))][0]
        if args.file
        else AlephClient().find_record(args.field, args.value)
    )

    if args.output is not None:
        writer = MARCWriter(open(args.output, "wb"))
        writer.write(record)
        writer.close()
    else:
        print(record)


if __name__ == "__main__":
    main()
