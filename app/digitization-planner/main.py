import os
from pymarc import MARCReader
from adapters.digitization_registry.rdcz.adapter import RDczAdapter
from adapters.digitization_registry.rdcz.custom_types import (
    SearchField,
    SearchTerm,
)
from time import sleep


DIR = "/home/robert/documents/scripts/records/MZK01/"


if __name__ == "__main__":
    rdcz = RDczAdapter(dict())

    files = os.listdir(DIR)

    for filename in files:
        system_number = os.path.splitext(filename)[0]

        file_path = os.path.join(DIR, filename)

        marc_record = [r for r in MARCReader(open(file_path, "rb"))][0]

        value = marc_record.get("001").value()

        try:
            records = rdcz.find_all(
                [SearchTerm(field=SearchField.ControlNumber, value=value)]
            )

            if len(records) == 0:
                print(f"{system_number},not_found")
            else:
                states = "|".join(
                    set(
                        state.value
                        for record in records
                        for state in record.recordState
                    )
                )
                print(f"{system_number},{states}")
        except Exception:
            print(f"{system_number},exception")
            sleep(5)
