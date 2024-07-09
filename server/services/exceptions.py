from fastapi import HTTPException, status


class CatalogRecordNotFoundException(HTTPException):
    def __init__(self, sysno):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Catalog record with system number {sysno} was not found",
        )


class EditingPreviousDistributionForbiddenException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Previous distributions can not be edited in any manner",
        )


class DistributionExcesiveSubcategoriesException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Percentage distribution contains categories "
            "that do not belong to the category.",
        )


class DistributionMissingSubcategoriesException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Percentage distribution does not contains "
            "all children from one parent",
        )


class InvalidDistributionSumException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Percentage of all categories on one "
            "level has to sum to 100.",
        )


class DistributionNotFoundException(HTTPException):
    def __init__(self, intention_id, category_id):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Distribution for intention {intention_id} and "
            f"category {category_id} was not found",
        )


class GeneratedExtractionNotFoundException(HTTPException):
    def __init__(self, id):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Generated extraction with id {id} was not found",
        )


class CategoryNotFoundException(HTTPException):
    def __init__(self, id):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with id {id} was not found",
        )


class MaximumCategoryLevelException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum category level reached",
        )


class DepartmentNotFoundException(HTTPException):
    def __init__(self, id):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with id {id} was not found",
        )


class DocumentNotFoundException(HTTPException):
    def __init__(self, id):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id {id} was not found",
        )


class UniqueViolationException(HTTPException):
    def __init__(self, detail):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class UniqueDocumentViolationException(UniqueViolationException):
    def __init__(self, sysno, barcode, volume):
        super().__init__(
            detail=f"Document with sysno {sysno}, volume {volume} "
            f"and barcode {barcode} already exists"
        )


class UniqueCategoryNameViolationException(UniqueViolationException):
    def __init__(self):
        super().__init__(
            detail="Category does not have unique name amongst its siblings"
        )


class UniqueQuotaNameViolationException(UniqueViolationException):
    def __init__(self):
        super().__init__(detail="The quota must have a unique name")


class UserNotAllowedException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is forbidden to perform action",
            headers={"WWW-Authenticate": "Bearer"},
        )


class UserNotAllowedToReadDocumentsException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is forbidden to read any documents",
            headers={"WWW-Authenticate": "Bearer"},
        )


class CredentialsException(HTTPException):
    def __init__(self, detail="Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class DocumentAlreadyExtractedException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Some documents have already been extracted",
        )


class DocumentsNotInExtractionException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some documents are not in this extraction",
        )


class CannotExtractDocumentWithoutPagesCount(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documents without pages count cannot be extracted",
        )


class CannotExtractDocumentWithoutCNB(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documents without CNB cannot be extracted",
        )


class EmptyExtraction(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty extraction can not be created",
        )


class CategoryInDistributionDeletionException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only categories that have percentage distribution 0 "
            "can be deleted",
        )


class NonEmptyCategoryDeletionException(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only empty categories can be deleted",
        )


class WrongInputException(HTTPException):
    def __init__(self, detail):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST, detail=detail
        )


class MissingArgumentException(HTTPException):
    def __init__(self, detail):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST, detail=detail
        )
