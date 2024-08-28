from fastapi import HTTPException, status


class CannotExtractDocumentWithoutCNB(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documents without CNB cannot be extracted",
        )


class CannotExtractDocumentWithoutPagesCount(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documents without pages count cannot be extracted",
        )


class DocumentAlreadyExtractedException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Some documents have already been extracted",
        )
