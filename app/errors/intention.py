from fastapi import HTTPException, status


class EndDateTooCloseToStartDateError(HTTPException):
    def __init__(self, margin_days: int):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"The end date must be at least {margin_days} days "
                "after the start date."
            ),
        )


class StartDateUpdateNotAllowedError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The start date of this intention cannot be changed "
                "because it is already linked to "
                "one or more digitization lists."
            ),
        )


class DeleteNotAllowedWithDigitizationListsError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This intention cannot be deleted because it is used "
                "in one or more digitization lists."
            ),
        )


class DeleteNotAllowedLinkedToProjectError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This intention cannot be deleted "
                "because it is linked to a project."
            ),
        )


class IntentionLinkedToProjectError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cannot change the target page count, start date"
                "or end date of an intention that is linked to a project."
            ),
        )
