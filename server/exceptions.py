class InvalidSysnoException(Exception):
    def __init__(self, format, actual):
        super().__init__(f"Invalid sysno format. Expecting sysno of format '{format}', got '{actual}'.")


class InvalidSysnoBaseException(Exception):
    def __init__(self, expected, actual):
        super().__init__(f"Sysno's base was not recognize. Expecting one of {expected}, got '{actual}'.")
        self.expected = expected
        self.actual = actual
