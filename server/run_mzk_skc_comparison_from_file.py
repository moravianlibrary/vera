from time import sleep
from pymarc import MARCReader
from services.marc_records_comparator.records_comparator import (
    MarcRecordsComparator,
)
from services.marc_records_comparator.special_comparators.edition import (
    EditionFieldComparator,
)
from sys import argv


comparator = MarcRecordsComparator({"250": EditionFieldComparator()})

with open("/tmp/mzk_skc.mapping", "r") as f:
    f.readline()
    for line in f.readlines():
        sysnos = line.strip().split(":")

        if len(argv) > 1 and sysnos[0] not in argv[1:]:
            continue

        print(f"Processing records: {sysnos[0]} - {sysnos[1]}")

        mzk_marc21 = list(MARCReader(open(f"/tmp/{sysnos[0]}.marc", "rb")))[0]
        skc_marc21 = list(MARCReader(open(f"/tmp/{sysnos[1]}.marc", "rb")))[0]

        if mzk_marc21 is None:
            print(f"Skipping record {sysnos[0]} because it can not be parsed")
            continue
        if skc_marc21 is None:
            print(f"Skipping record {sysnos[1]} because it can not be parsed")
            continue

        records_difference = comparator.evaluate(mzk_marc21, skc_marc21)

        with open(f"/tmp/{sysnos[0]}.txt", "w") as wf:
            wf.write(
                "\n".join(list(str(record) for record in records_difference))
            )
            wf.write("\n")

        sleep(2)
