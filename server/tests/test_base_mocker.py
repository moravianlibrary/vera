from unittest import TestCase
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Union
from models import CatalogRecord, Document, Location
from services.external.digitization_registry import DigitizationState

TEST_MARC_BYTES = b"00048    a2200037   4500001001000000\x1e000121929\x1e\x1d"

IGNORED_KEYS = ["sysno", "added_by"]


class TestBaseMocker(TestCase):
    def mockDocuments(
        self,
        data: Dict[str, List[Any]],
        generate_main_marc: bool = True,
        generate_skc_marc: bool = True,
        generate_cnb_marc: bool = True,
    ) -> None:
        all_keys = list(data.keys())
        max_length = max(len(v) for v in data.values())

        for key in data:
            if len(data[key]) < max_length:
                data[key].extend([None] * (max_length - len(data[key])))
        if "sysno" not in data:
            data["sysno"] = [None] * max_length
        
        created_sysnos = set()

        for i in range(max_length):
            sysno = data["sysno"][i] or f"MZK00-{str(i + 1).zfill(9)}"

            if sysno in created_sysnos:
                continue

            self.session.add(
                CatalogRecord(
                    sysno=sysno,
                    cnb=data["cnb"][i] if "cnb" in all_keys else None,
                    marc=data.get(
                        "marc", TEST_MARC_BYTES if generate_main_marc else None
                    ),
                    skc_marc=data.get(
                        "skc_marc",
                        TEST_MARC_BYTES if generate_skc_marc else None,
                    ),
                    cnb_marc=data.get(
                        "cnb_marc",
                        TEST_MARC_BYTES if generate_cnb_marc else None,
                    ),
                    signature=(
                        data["signature"][i]
                        if "signature" in all_keys
                        else None
                    ),
                )
            )
            created_sysnos.add(sysno)
        
        self.session.flush()

        for i in range(max_length):
            sysno = data["sysno"][i] or f"MZK00-{str(i + 1).zfill(9)}"

            document_data = {key: data.get(key)[i] for key in all_keys}
            self.session.add(
                Document(
                    sysno=sysno,
                    added_by=(
                        data["added_by"][i]
                        if "added_by" in all_keys
                        else "test_user"
                    ),
                    **{
                        key: value
                        for key, value in document_data.items()
                        if key not in IGNORED_KEYS
                    },
                )
            )

        self.session.flush()
