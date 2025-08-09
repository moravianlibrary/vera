from fastapi import HTTPException, status


def cycle_detected_error(category_id: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"Cycle detected in category hierarchy while updating parent "
            f"for category id {category_id}."
        ),
    )


def invalid_level_error(category_id: int, level: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"Category level {level} exceeds allowed limits "
            f"while updating parent for category id {category_id}."
        ),
    )


def category_not_child_error(
    category_id: int, parent_id: int | None
) -> HTTPException:
    parent_text = (
        f"category with id {parent_id}"
        if parent_id is not None
        else "root category"
    )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"Category with id {category_id} is not a child "
            f"of the {parent_text}."
        ),
    )
