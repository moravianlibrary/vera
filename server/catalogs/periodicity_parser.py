
RANGE_MIN = 0
RANGE_MAX = 9999


class RangeMapper:
    def __init__(self):
        self.mappings = []

    def add_mapping(self, start, end, label):
        self.mappings.append((start, end, label))

    def map_value(self, value):
        for start, end, label in self.mappings:
            if start <= value < end:
                return label
        return None
