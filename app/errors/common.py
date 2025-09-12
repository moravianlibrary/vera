from fastapi import HTTPException, status


class BatchParamsConflictError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "You cannot provide both a batch ID "
                "and a batch name or file name. "
                "Please provide only one option."
            ),
        )


class BatchPermissionDeniedError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You cannot access this batch "
                "because it was created by another user."
            ),
        )


class BatchProjectMismatchError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "The batch does not belong to the specified project. "
                "Please check the project ID."
            ),
        )


class EntityNotFoundError(HTTPException):
    def __init__(self, entity_name: str, entity_id: int | str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(f"{entity_name} with ID '{entity_id}' not found."),
        )
