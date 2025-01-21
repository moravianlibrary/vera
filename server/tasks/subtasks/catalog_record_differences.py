from typing import Iterable, Dict, Set
from sqlalchemy.orm import Session
from models import (
    CatalogRecord,
    CatalogRecordFieldDifference,
    CatalogRecordSubfieldDifference,
)
from services.marc_comparator import (
    MarcRecordsComparator,
    MarcFieldsComparator,
    EditionFieldComparator,
    GeneralInformationComparator,
    MarcFieldDifference,
)
from pymarc import Record
from datatypes import CatalogSource

MzkSkcRecordsComparator = MarcRecordsComparator(
    {
        "008": GeneralInformationComparator(),
        "015": MarcFieldsComparator("015", subfield_codes=["a"]),
        "020": MarcFieldsComparator("020", subfield_codes=["a"]),
        "250": EditionFieldComparator(),
        "260": MarcFieldsComparator("260", subfield_codes=["a", "b", "c"]),
        "264": MarcFieldsComparator("264", subfield_codes=["a", "b", "c"]),
        "300": MarcFieldsComparator(
            "300", subfield_codes=["a", "b", "c", "e"]
        ),
        "362": MarcFieldsComparator("362", subfield_codes=["a"]),
    },
    True,
    True,
)
MzkCnbRecordsComparator = MarcRecordsComparator(
    {
        "008": GeneralInformationComparator(),
        "015": MarcFieldsComparator("015", subfield_codes=["a"]),
        "020": MarcFieldsComparator("020", subfield_codes=["a"]),
    },
    True,
    True,
)


def _update_catalog_record_difference(
    session: Session,
    sysno: str,
    main_record: Record,
    source: CatalogSource,
    other_record: Record,
    actual_differences: Iterable[CatalogRecordFieldDifference],
    comparator: MarcRecordsComparator,
) -> CatalogRecord:
    actual_difference_models_map: Dict[
        MarcFieldDifference, CatalogRecordFieldDifference
    ] = {}
    old_differences: Set[MarcFieldDifference] = set()

    for difference_model in actual_differences:
        difference = MarcFieldDifference.model_validate(difference_model)
        actual_difference_models_map[difference] = difference_model
        old_differences.add(difference)

    new_differences = set(comparator.evaluate(main_record, other_record))

    for difference in old_differences - new_differences:
        actual_difference_models_map[difference].delete(session)

    for difference in new_differences - old_differences:
        field_difference = CatalogRecordFieldDifference(
            sysno=sysno,
            source=source,
            tag=difference.tag,
            indicator1=difference.indicator1,
            indicator2=difference.indicator2,
            difference_type=difference.difference_type,
        ).save(session)

        for subfield in difference.subfield_differences:
            CatalogRecordSubfieldDifference(
                field_difference_id=field_difference.id,
                code=subfield.code,
                value=subfield.value,
                different_to=subfield.different_to,
                differs=subfield.differs,
            ).save(session)


def update_catalog_record_differences(
    session: Session, catalog_record: CatalogRecord
):
    if catalog_record.skc_record is not None:
        _update_catalog_record_difference(
            session,
            catalog_record.sysno,
            catalog_record.main_record,
            CatalogSource.SKC,
            catalog_record.skc_record,
            catalog_record.skc_difference,
            MzkSkcRecordsComparator,
        )
    if catalog_record.cnb_record is not None:
        _update_catalog_record_difference(
            session,
            catalog_record.sysno,
            catalog_record.main_record,
            CatalogSource.CNB,
            catalog_record.cnb_record,
            catalog_record.cnb_difference,
            MzkCnbRecordsComparator,
        )
