from fastapi import HTTPException, status


class FieldDifferenceAlreadyApprovedException(HTTPException):
    def __init__(self, field_difference_id: int):
        self.field_difference_id = field_difference_id
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field difference with id {field_difference_id} "
            "already approved",
        )
