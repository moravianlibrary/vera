from typing import Optional
from pymarc import Record, MARCReader


def marc_binary_to_record(marc_binary: bytes) -> Optional[Record]:
    if marc_binary is None:
        return None
    reader = MARCReader(marc_binary)
    try:
        for record in reader:
            return record
    except Exception:
        return None
    finally:
        reader.close()
