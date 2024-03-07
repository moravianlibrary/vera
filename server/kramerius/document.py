from typing import Dict, Optional
from kramerius.types import SolrField


class KrameriusDocument:
    def __init__(self, document: Dict):
        self.document = document

    def get_field_value(self, field: SolrField):
        return (
            self.document[field.value]
            if field.value in self.document
            else None
        )

    @property
    def pid(self):
        return self.get_field_value(SolrField.Pid)

    @property
    def parentPid(self):
        return self.get_field_value(SolrField.ParentPid)

    @property
    def licences(self):
        return self.get_field_value(SolrField.Licences)

    @property
    def model(self):
        return self.get_field_value(SolrField.Model)

    @property
    def modelPath(self):
        return self.get_field_value(SolrField.ModelPath)

    @property
    def barcode(self):
        return self.get_field_value(SolrField.Barcode)

    @property
    def signature(self):
        return self.get_field_value(SolrField.Signature)

    @property
    def cnb(self):
        return self.get_field_value(SolrField.Cnb)

    @property
    def sysno(self):
        return self.get_field_value(SolrField.Sysno)

    @property
    def date_min(self):
        return self.get_field_value(SolrField.DateMin)

    @property
    def date_max(self):
        return self.get_field_value(SolrField.DateMax)

    @property
    def date_range_start_year(self) -> Optional[int]:
        return self.get_field_value(SolrField.DateRangeStartYear)

    @property
    def date_range_end_year(self) -> Optional[int]:
        return self.get_field_value(SolrField.DateRangeEndYear)

    @property
    def title(self):
        return self.get_field_value(SolrField.Title)

    @property
    def title_sort(self):
        return self.get_field_value(SolrField.TitleSort)

    @property
    def part_number_sort(self):
        return self.get_field_value(SolrField.PartNumberSort)

    @property
    def part_number_string(self):
        return self.get_field_value(SolrField.PartNumberString)

    def __str__(self) -> str:
        return (
            f"PID: {self.pid}\n"
            f"Parent PID: {self.parentPid}\n"
            f"Licences: {self.licences}\n"
            f"Model: {self.model}\n"
            f"Model path: {self.modelPath}\n"
            f"Barcode: {self.barcode}\n"
            f"Signature: {self.signature}\n"
            f"CNB: {self.cnb}\n"
            f"Sysno: {self.sysno}\n"
            f"Date min: {self.date_min}\n"
            f"Date max: {self.date_max}\n"
            f"Date range start year: {self.date_range_start_year}\n"
            f"Date range end year: {self.date_range_end_year}\n"
            f"Part number sort: {self.part_number_sort}\n"
            f"Part number string: {self.part_number_string}\n"
        )
