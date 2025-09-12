from fastapi import HTTPException, status


class ProjectStatusAlreadySetError(HTTPException):
    def __init__(self, current_status: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project status is already '{current_status}'.",
        )


class ProjectStatusTransitionError(HTTPException):
    def __init__(self, current_status: str, attempted_status: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot change project status from '{current_status}' "
                f"to '{attempted_status}'."
            ),
        )


class CannotAddDocumentsToUnapprovedProjectError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Documents can only be added "
                "to projects that have been approved."
            ),
        )
