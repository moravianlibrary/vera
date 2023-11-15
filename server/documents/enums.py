from enum import Enum


class IdentifierType(Enum):
    SYSNO = 'SYSNO'
    BARCODE = 'BARCODE'


class MaterialType(Enum):
    book = 'book'
    continuing_resource = 'continuing_resource'
    map = 'map'
    music = 'music'
    other = 'other'


class IssuanceType(Enum):
    edition = 'edition'
    volume = 'volume'
    item = 'item'
