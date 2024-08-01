from typing import Any, Dict, List, Union
from models import CatalogRecord, Document, Location
from services.external.digitization_registry import DigitizationState


def generate_documents(
    data: Dict[str, List[Any]]
) -> List[Union[CatalogRecord, Document]]:
    all_keys = list(data.keys())
    max_length = max(len(v) for v in data.values())

    for key in data:
        if len(data[key]) < max_length:
            data[key].extend([None] * (max_length - len(data[key])))
    if "sysno" not in data:
        data["sysno"] = [None] * max_length

    sysnos = set()
    items = []
    ignored_keys = [
        "sysno",
        "added_by",
        "digitization_state",
        "marc_path",
        "cnb",
        "signature",
    ]

    for i in range(max_length):
        sysno = data["sysno"][i] or f"MZK00-{str(i + 1).zfill(9)}"

        if sysno not in sysnos:
            if "marc_path" in all_keys:
                with open(data["marc_path"][i], "rb") as f:
                    marc = f.read()
            else:
                marc = None
            items.append(
                CatalogRecord(
                    sysno=sysno,
                    cnb=data["cnb"][i] if "cnb" in all_keys else None,
                    marc=marc,
                    signature=(
                        data["signature"][i]
                        if "signature" in all_keys
                        else None
                    ),
                )
            )
            sysnos.add(sysno)

        document_data = {key: data.get(key)[i] for key in all_keys}
        items.append(
            Document(
                sysno=sysno,
                added_by=(
                    data["added_by"][i]
                    if "added_by" in all_keys
                    else "test_user"
                ),
                digitization_state=(
                    data["digitization_state"][i]
                    if "digitization_state" in all_keys
                    else DigitizationState.NotDigitized
                ),
                **{
                    key: value
                    for key, value in document_data.items()
                    if key not in ignored_keys
                },
            )
        )

    return items


def generate_locations(data: Dict[str, List[Any]]) -> List[Location]:
    all_keys = list(data.keys())
    max_length = max(len(v) for v in data.values())

    for key in data:
        if len(data[key]) < max_length:
            data[key].extend([None] * (max_length - len(data[key])))

    items = []
    for i in range(max_length):
        location_data = {key: data.get(key)[i] for key in all_keys}
        items.append(
            Location(
                **{key: value for key, value in location_data.items()},
            )
        )

    return items
