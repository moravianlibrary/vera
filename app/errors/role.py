from fastapi import HTTPException, status


class AdminRoleModificationError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The Admin role cannot be modified.",
        )


class AdminRoleDeletionError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The Admin role cannot be deleted.",
        )
