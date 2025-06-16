from typing import Optional
from ..fields_comparator import MarcFieldsComparator


class Marc008Field:
    def __init__(self, data: str):
        self.data = data

    @property
    def date_entered(self) -> str:
        return self.data[:6]

    @property
    def date1(self) -> str:
        return self.data[7:11]

    @property
    def date2(self) -> str:
        return self.data[11:15]

    @property
    def place_of_publication(self) -> str:
        return self.data[15:18]

    @property
    def language(self) -> str:
        return self.data[35:38]


class GeneralInformationComparator(MarcFieldsComparator):
    def __init__(self):
        super().__init__("008")

    def is_same_value(
        self, value1: Optional[str], value2: Optional[str]
    ) -> bool:
        if value1 is None and value2 is None:
            return True
        if value1 is None or value2 is None:
            return False

        field1 = Marc008Field(value1.replace(" ", "-"))
        field2 = Marc008Field(value2.replace(" ", "-"))

        return (
            field1.date1 == field2.date1
            and field1.date2 == field2.date2
            and field1.place_of_publication == field2.place_of_publication
            and field1.language == field2.language
        )
