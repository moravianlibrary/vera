from pymarc import Field, Record, Subfield
from schemas.marc21_diff import Marc21DiffType, Marc21Diff, Marc21DiffRecord
from typing import List, Optional, Set


def compare_field_values(field1: Field, field2: Field) -> bool:
    return field1.data.strip() == field2.data.strip()


def find_control_field(fields: List[Field], tag: str) -> Optional[Field]:
    for field in fields:
        if field.is_control_field() and field.tag == tag:
            return field
    return None


def find_data_fields(
    fields: List[Field],
    tag: str,
    ind1: Optional[str] = None,
    ind2: Optional[str] = None,
) -> List[Field]:
    return [
        field
        for field in fields
        if (
            not field.is_control_field()
            and field.tag == tag
            and (ind1 is None or field.indicator1 == ind1)
            and (ind2 is None or field.indicator2 == ind2)
        )
    ]


def find_subfields(subfields: List[Subfield], code: str) -> Optional[Subfield]:
    return [subfield for subfield in subfields if subfield.code == code]


def are_subfields_equal(field1: Field, field2: Field) -> bool:
    field1_codes = set([sub.code for sub in field1.subfields])
    field2_codes = set([sub.code for sub in field2.subfields])

    if field1_codes != field2_codes:
        return False

    for code in field1_codes:
        code1_values = set(
            [sub.value.strip() for sub in field1.subfields if sub.code == code]
        )
        code2_values = set(
            [sub.value.strip() for sub in field2.subfields if sub.code == code]
        )
        if code1_values != code2_values:
            return False

    return True


def get_control_field_diff(
    field: Field, find_in: Set[Field]
) -> Optional[Marc21Diff]:
    found = find_control_field(find_in, field.tag)
    if found is None:
        return Marc21Diff.from_marc21_field(Marc21DiffType.ExtraField, field)
    if not compare_field_values(field, found):
        find_in.remove(found)
        return Marc21Diff.from_marc21_field(
            Marc21DiffType.DifferentValue, field, found.data
        )
    find_in.remove(found)
    return None


def get_data_field_diff(
    field: Field, find_in: Set[Field]
) -> Optional[Marc21Diff]:
    found = find_data_fields(
        find_in, field.tag, field.indicator1, field.indicator2
    )
    if len(found) == 0:
        return Marc21Diff.from_marc21_field(Marc21DiffType.ExtraField, field)
    for found_field in found:
        if are_subfields_equal(field, found_field):
            find_in.remove(found_field)
            return None
    return Marc21Diff.from_marc21_field(Marc21DiffType.ExtraField, field)


def get_field_diff(field: Field, find_in: List[Field]) -> Optional[Marc21Diff]:
    if field.is_control_field():
        return get_control_field_diff(field, find_in)
    return get_data_field_diff(field, find_in)


def compare_marc21_records(
    sysno1: str, record1: Record, sysno2: str, record2: Record
) -> Marc21DiffRecord:
    all_tags = sorted(
        set([field.tag for field in record1.fields]).union(
            set([field.tag for field in record2.fields])
        )
    )

    diffs = []

    for tag in all_tags:
        mzk_fields = record1.get_fields(tag)
        skc_fields = set(record2.get_fields(tag))

        if len(mzk_fields) == 0 and len(skc_fields) > 0:
            for skc_field in skc_fields:
                diffs.append(
                    Marc21Diff.from_marc21_field(
                        Marc21DiffType.MissingField, skc_field
                    )
                )
            continue
        elif len(mzk_fields) > 0 and len(skc_fields) == 0:
            for mzk_field in mzk_fields:
                diffs.append(
                    Marc21Diff.from_marc21_field(
                        Marc21DiffType.ExtraField, mzk_field
                    )
                )
            continue

        for mzk_field in mzk_fields:
            diff = get_field_diff(mzk_field, skc_fields)
            if diff:
                diffs.append(diff)
            else:
                diffs.append(
                    Marc21Diff.from_marc21_field(
                        Marc21DiffType.Equal, mzk_field
                    )
                )

        for skc_field in skc_fields:
            diffs.append(
                Marc21Diff.from_marc21_field(
                    Marc21DiffType.MissingField, skc_field
                )
            )

    return Marc21DiffRecord(sysno1=sysno1, sysno2=sysno2, diffs=diffs)


EVALUATE_SIMILARITY_FOR_FIELDS = [
    "041",
    "245",
    "250",
    "260",
    "264",
    "300",
    "310",
    "321",
]


def calculate_records_similarity(record1: Record, record2: Record) -> float:
    from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore
    from sklearn.metrics.pairwise import cosine_similarity  # type: ignore

    def calculate_similarity(text1: str, text2: str):
        vectorizer = TfidfVectorizer().fit_transform([text1, text2])
        vectors = vectorizer.toarray()
        cosine_sim = cosine_similarity(vectors)
        return cosine_sim[0, 1]

    similarity = 0.0
    n = 0

    for field_code in EVALUATE_SIMILARITY_FOR_FIELDS:
        fields1 = record1.get_fields(field_code)
        fields2 = record2.get_fields(field_code)
        if len(fields1) > 0 and len(fields2) > 0:
            text1 = "".join([f.value() for f in fields1])
            text2 = "".join([f.value() for f in fields2])
            similarity += calculate_similarity(
                text1,
                text2,
            )
            n += 1

    return similarity / n


# def compare_mzk_with_skc(
#     sysno: str, cnb: Optional[str], isn: Optional[str]
# ) -> List[Marc21Diff]:
#     mzk_marc21 = aleph_api.get_marc21_document(sysno)
#     skc_sysno, skc_marc21 = skc_api.get_sysno_marc21(cnb, isn)

#     if mzk_marc21 is None:
#         raise ValueError(f"Document {sysno} not found in MZK")
#     if skc_marc21 is None:
#         raise ValueError(f"Document {skc_sysno} not found in SKC")

#     return compare_marc21_records(mzk_marc21, skc_marc21)


# diffs = compare_mzk_with_skc("MZK01-000033633", "cnb003367815", None)

# diffs = compare_mzk_with_skc("MZK01-000602672", "cnb000568682", None)

# with open("/tmp/check_mzk_vs_skc_from_vera", "r") as f:
#     for line in f.readlines():
#         ids = line.strip().split("\t")

#         if len(ids) < 2:
#             continue

#         diffs = []
#         mzk_marc21 = aleph_api.get_marc21_document(ids[0])
#         skc_sysno, skc_marc21 = None, None

#         if len(ids) == 3:
#             skc_sysno, skc_marc21 = skc_api.get_sysno_marc21(ids[1], ids[2])
#         elif len(ids) == 2:
#             skc_sysno, skc_marc21 = skc_api.get_sysno_marc21(ids[1], None)

#         if mzk_marc21 is None:
#             raise ValueError(f"Document {ids[0]} not found in MZK")
#         if skc_marc21 is None:
#             with open(f"/tmp/{ids[0]}.txt", "w") as wf:
#                 wf.write(f"MZK_SYSNO: {ids[0]}\n")
#                 wf.write(f"CNB: {ids[1]}\n")
#                 wf.write(f"ISN: {ids[2] if len(ids) == 3 else 'None'}\n")
#                 wf.write("SKC_SYSNO: Not Found\n")
#             continue

#         diffs = compare_marc21_records(mzk_marc21, skc_marc21)

#         with open(f"/tmp/{ids[0]}.txt", "w") as wf:
#             wf.write(f"MZK_SYSNO: {ids[0]}\n")
#             wf.write(f"SKC_SYSNO: {skc_sysno}\n")
#             wf.write("\n".join([str(diff) for diff in diffs]))
#             wf.write("\n")

#         sleep(2)
