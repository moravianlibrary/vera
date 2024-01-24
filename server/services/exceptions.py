from fastapi import HTTPException, status


class UniqueViolationException(HTTPException):
    def __init__(self, detail):
        super().__init__(status_code=status.HTTP_409_CONFLICT,
                         detail=detail)


class UniqueCategoryNameViolationException(UniqueViolationException):
    def __init__(self):
        super().__init__(detail="Category does not have unique name"
                         "amongst its siblings")


class UniqueQuotaNameViolationException(UniqueViolationException):
    def __init__(self):
        super().__init__(detail="The quota must have a unique name")


class UserNotAllowedException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN,
                         detail="User is forbidden to perform action",
                         headers={"WWW-Authenticate": "Bearer"})


class UserNotAllowedToReadDocumentsException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN,
                         detail="User is forbidden to read any documents",
                         headers={"WWW-Authenticate": "Bearer"})


class CredentialsException(HTTPException):
    def __init__(self, detail="Could not validate credentials"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED,
                         detail=detail,
                         headers={"WWW-Authenticate": "Bearer"})


class CategoryIsNotEmptyException(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST,
                         detail="Only empty categories can be deleted")


class WrongInputException(HTTPException):
    def __init__(self, detail):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST,
                         detail=detail)


class MissingArgumentException(HTTPException):
    def __init__(self, detail):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST,
                         detail=detail)
