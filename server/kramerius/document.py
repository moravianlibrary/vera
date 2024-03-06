from typing import Dict
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
