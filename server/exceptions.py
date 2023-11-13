class CatalogException(Exception):
    pass


class CatalogRecordNotFoundException(CatalogException):
    def __init__(self, sysno):
        super().__init__(f"Could not find record with sysno '{sysno}' in catalog.")


class CatalogRecordParseException(CatalogException):
    def __init__(self, sysno, field):
        super().__init__(f"Could not parse field '{field}' from record with sysno '{sysno}'.")


class InvalidSysnoException(CatalogException):
    def __init__(self, format, actual):
        super().__init__(f"Invalid sysno format. Expecting sysno of format '{format}', got '{actual}'.")


class InvalidSysnoBaseException(CatalogException):
    def __init__(self, expected, actual):
        super().__init__(f"Sysno's base was not recognize. Expecting one of {expected}, got '{actual}'.")
        self.expected = expected
        self.actual = actual
