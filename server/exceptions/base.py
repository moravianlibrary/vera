from fastapi import HTTPException, status
from datatypes import IdType


class ObjectNotFoundException(HTTPException):
    def __init__(self, object_name: str, object_id: IdType):
        self.object_name = object_name
        self.object_id = object_id
        self.message = f"{object_name} with id {object_id} not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND, detail=self.message
        )


class BadCredentialsException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad credentials"
        )


class PermissionDeniedException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied"
        )


class RequiresAuthenticationException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Requires authentication",
        )


class WrongInputException(HTTPException):
    def __init__(self, detail):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST, detail=detail
        )


class MissingArgumentException(HTTPException):
    def __init__(self, detail):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST, detail=detail
        )


class ObjectMissingRequiredFieldException(HTTPException):
    def __init__(self, object_name: str, object_id: IdType, field_name: str):
        self.object_name = object_name
        self.object_id = object_id
        self.field_name = field_name
        self.message = (
            f"{object_name} with id {object_id} "
            f"is missing required field {field_name}"
        )
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST, detail=self.message
        )
