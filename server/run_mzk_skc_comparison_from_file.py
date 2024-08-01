from time import sleep
from services.external.aleph import AlephClient
from services.external.nkp_aleph.client import NkpAlephClient
from procedures.catalog_records_comparator import compare_marc21_records


aleph_api = AlephClient()
skc_api = NkpAlephClient()

with open("/tmp/check_mzk_vs_skc_from_vera", "r") as f:
    f.readline()
    for line in f.readlines():
        ids = line.strip().split("\t")
        print(f"Processing identifiers: {ids}")

        if len(ids) < 2:
            continue

        diffs = []
        aleph_record, _ = aleph_api.get_record(ids[0])
        mzk_marc21 = aleph_record.record

        if len(ids) == 3:
            skc_sysno = skc_api.find_nkp_sysno(ids[1], ids[2], "SKC")
        elif len(ids) == 2:
            skc_sysno = skc_api.find_nkp_sysno(ids[1], None, "SKC")
        else:
            skc_sysno = None

        skc_marc21 = (
            skc_api.get_marc21(skc_sysno, "SKC") if skc_sysno else None
        )

        if mzk_marc21 is None:
            raise ValueError(f"Document {ids[0]} not found in MZK")
        if skc_marc21 is None:
            with open(f"/tmp/{ids[0]}.txt", "w") as wf:
                wf.write(f"MZK_SYSNO: {ids[0]}\n")
                wf.write(f"CNB: {ids[1]}\n")
                wf.write(f"ISN: {ids[2] if len(ids) == 3 else 'None'}\n")
                wf.write("SKC_SYSNO: Not Found\n")
            continue

        records_difference = compare_marc21_records(
            ids[0], mzk_marc21, skc_sysno, skc_marc21
        )

        with open(f"/tmp/{ids[0]}.txt", "w") as wf:
            wf.write(str(records_difference))
            wf.write("\n")

        sleep(2)
