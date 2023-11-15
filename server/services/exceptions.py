from fastapi import HTTPException, status


class UserNotAllowedException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN,
                         detail="User is not allowed to perform action",
                         headers={"WWW-Authenticate": "Bearer"})


class UserNotAllowedToReadDocumentsException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN,
                         detail="User is forbidden to read any documents",
                         headers={"WWW-Authenticate": "Bearer"})


class CredentialsException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED,
                         detail="Could not validate credentials",
                         headers={"WWW-Authenticate": "Bearer"})


class MissingArgumentException(HTTPException):
    def __init__(self, detail):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST,
                         detail=detail)


class DocumentNotFoundException(HTTPException):
    def __init__(self, detail):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND,
                         detail=f"Document with id {id} not found.")


class CatalogException(Exception):
    pass


class CatalogRecordNotFoundException(CatalogException):
    def __init__(self, sysno):
        super().__init__(f"Could not find record \
                         with sysno '{sysno}' in catalog.")


class CatalogRecordParseException(CatalogException):
    def __init__(self, sysno, field):
        super().__init__(f"Could not parse field '{field}' \
                         from record with sysno '{sysno}'.")


class InvalidSysnoException(CatalogException):
    def __init__(self, format, actual):
        super().__init__(f"Invalid sysno format. \
            Expecting sysno of format '{format}', got '{actual}'.")


class InvalidSysnoBaseException(CatalogException):
    def __init__(self, expected, actual):
        super().__init__(f"Sysno's base was not recognize. \
            Expecting one of {expected}, got '{actual}'.")
        self.expected = expected
        self.actual = actual
