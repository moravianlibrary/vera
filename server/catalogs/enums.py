from enum import Enum


class DigitizationState(Enum):
    FINISHED = 'FINSHED'
    IN_PROGRESS = 'IN_PROGRESS'
    PLANNED = 'PLANNED'
    NOT_DIGITIZED = 'NOT_DIGITIZED'


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
