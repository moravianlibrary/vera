import argparse
from .client import DigitizationRegistryClient


def main():
    argparser = argparse.ArgumentParser()
    argparser.add_argument("--barcode", help="Barcode to search for")
    argparser.add_argument(
        "--cnb",
        help="CNB to search for",
    )
    argparser.add_argument(
        "--isxn",
        help="ISXN to search for",
    )
    argparser.add_argument(
        "--year",
        help="Year of the volume to search for",
    )
    argparser.add_argument(
        "--volume",
        help="Volume to search for",
    )
    argparser.add_argument(
        "--bundle",
        help="Bundle to search for",
    )

    args = argparser.parse_args()

    if args.barcode is None and args.cnb is None and args.isxn is None:
        print("One of --barcode, --cnb or --isxn must be provided")
        exit(0)

    record = DigitizationRegistryClient().get_record(
        barcode=args.barcode,
        cnb=args.cnb,
        isxn=args.isxn,
        year=args.year,
        volume=args.volume,
        bundle=args.bundle,
    )

    print(record.digitization_state if record else "Not found")


if __name__ == "__main__":
    main()
