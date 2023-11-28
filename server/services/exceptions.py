from fastapi import HTTPException, status


class UniqueViolationException(HTTPException):
    def __init__(self, detail):
        super().__init__(status_code=status.HTTP_409_CONFLICT,
                         detail=detail)


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


class WrongInputException(HTTPException):
    def __init__(self, detail):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST,
                         detail=detail)


class MissingArgumentException(HTTPException):
    def __init__(self, detail):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST,
                         detail=detail)
