from fastapi import HTTPException, status


class CannotExtractDocumentWithInvalidMainRecord(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document with invalid main catalog record "
            "cannot be extracted",
        )


class CannotExtractDocumentWithInvalidCnb(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document with invalid CNB cannot be extracted",
        )


class CannotExtractDocumentWithoutPageCount(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document without page count cannot be extracted",
        )


class ExtractingDocumentsWithDigitizationStateDisabled(HTTPException):
    def __init__(self, digitization_state_str: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Extracting documents with digitization state "
            f"'{digitization_state_str}' is disabled for this request",
        )


class DocumentAlreadyExtractedException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document has been already extracted",
        )
