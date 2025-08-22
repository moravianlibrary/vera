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
