from enum import Enum


class ActionType(Enum):
    ReadDatatableOwn = "ReadDatatableOwn"
    ReadDatatableDepartment = "ReadDatatableDepartment"
    ReadDatatableAll = "ReadDatatableAll"

    InsertDatatable = "InsertDatatable"

    EditDatatableOwn = "EditDatatableOwn"
    EditDatatableDepartment = "EditDatatableDepartment"
    EditDatatableAll = "EditDatatableAll"

    WriteDatatable = "WriteDatatable"
    CommentOnDatatable = "CommentOnDatatable"

    ReadCatalogRecords = "ReadCatalogRecords"
    ReviewCatalogRecords = "ReviewCatalogRecords"

    ReadCategoriesAll = "ReadCategoriesAll"
    ReadCategoriesDepartment = "ReadCategoriesDepartment"
    EditCategoriesAll = "EditCategoriesAll"
    EditCategoriesDepartment = "EditCategoriesDepartment"

    PlanTasks = "PlanTasks"
    AdminTasks = "AdminTasks"

    EditAccess = "EditAccess"
    EmulateAccess = "EmulateAccess"

    Extract = "Extract"
    AdminExtractions = "AdminExtractions"

    AdminDatabase = "AdminDatabase"
