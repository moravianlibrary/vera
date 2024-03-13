from enum import Enum

Wildcard = "*"


class SolrField(Enum):
    Pid = "pid"
    ParentPid = "own_parent.pid"

    Licences = "licenses"
    Model = "model"
    ModelPath = "own_model_path"

    Barcode = "id_barcode"
    Signature = "shelf_locators"
    Cnb = "id_ccnb"
    Sysno = "id_sysno"

    DateMin = "date.min"
    DateMax = "date.max"
    DateRangeStartYear = "date_range_start.year"
    DateRangeEndYear = "date_range_end.year"

    Title = "title.search"
    TitleSort = "title.sort"
    PartNumberSort = "part.number.sort"
    PartNumberString = "part.number.str"


class SolrConjuction(Enum):
    And = " AND "
    Or = " OR "


class KrameriusModel(Enum):
    Periodical = "periodical"
    PeriodicalVolume = "periodicalvolume"
    PeriodicalItem = "periodicalitem"
    Supplement = "supplement"
    Article = "article"
    Monograph = "monograph"
    MonographUnit = "monographunit"
    Page = "page"


class TreePredicate(Enum):
    HasPage = "hasPage"
    HasPart = "hasPart"
    HasVolume = "hasVolume"
    HasItem = "hasItem"
    HasUnit = "hasUnit"
    HasIntCompPart = "hasIntCompPart"
    IsOnPage = "isOnPage"
