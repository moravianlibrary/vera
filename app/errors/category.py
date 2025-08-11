from fastapi import HTTPException, status


class CycleDetectedError(HTTPException):
    def __init__(self, category_id: int):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cycle detected in category hierarchy while updating parent "
                f"for category id {category_id}."
            ),
        )


class InvalidLevelError(HTTPException):
    def __init__(self, category_id: int, level: int):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Category level {level} exceeds allowed limits "
                f"while updating parent for category id {category_id}."
            ),
        )


class CategoryNotChildError(HTTPException):
    def __init__(self, category_id: int, parent_id: int | None):
        parent_text = (
            f"category with id {parent_id}"
            if parent_id is not None
            else "root category"
        )
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Category with id {category_id} is not a child "
                f"of the {parent_text}."
            ),
        )


class DifferentParentIDsException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from_parent_id and to_parent_id must be different.",
        )
