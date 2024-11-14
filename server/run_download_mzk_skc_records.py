from time import sleep
from mzk_aleph import AlephClient
from services.external.nkp_aleph.client import NkpAlephClient
from os import path


aleph_api = AlephClient()
skc_api = NkpAlephClient()

with open("/tmp/check_mzk_vs_skc_from_vera", "r") as f:
    f.readline()
    for line in f.readlines():
        ids = line.strip().split("\t")

        if path.exists(f"/tmp/{ids[0]}.marc"):
            print(f"Skipping {ids[0]}")
            continue

        print(f"Processing identifiers: {ids}")

        if len(ids) < 2:
            continue

        diffs = []
        aleph_record, _ = aleph_api.get_record(ids[0])
        if aleph_record is None:
            print(f"Document {ids[0]} not found in MZK catalog")
            continue
        mzk_marc21 = aleph_record.record

        skc_aleph_record = skc_api.get_skc_record(
            ids[1], ids[2] if len(ids) == 3 else None
        )
        if skc_aleph_record is None:
            print(
                f"No matching record for MZK sysno {ids[0]} "
                f"and identifiers CNB {ids[1]}, "
                f"ISXN {ids[2]} was found in SKC catalog"
            )
            continue
        skc_sysno = skc_aleph_record.sysno
        skc_marc21 = skc_aleph_record.record

        with open("/tmp/mzk_skc.mapping", "a") as wf:
            wf.write(f"{ids[0]}:{skc_sysno}\n")

        with open(f"/tmp/{ids[0]}.marc", "wb") as wf:
            wf.write(mzk_marc21.as_marc21())
        with open(f"/tmp/{skc_sysno}.marc", "wb") as wf:
            wf.write(skc_marc21.as_marc21())

        sleep(2)
