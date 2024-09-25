enum ActionType {
    ReadDatatableOwn = "ReadDatatableOwn",
    ReadDatatableDepartment = "ReadDatatableDepartment",
    ReadDatatableAll = "ReadDatatableAll",
    EditDatatableOwn = "EditDatatableOwn",
    EditDatatableDepartment = "EditDatatableDepartment",
    EditDatatableAll = "EditDatatableAll",
    WriteDatatable = "WriteDatatable",
    InsertDatatable = "InsertDatatable",
    CommentOnDatatable = "CommentOnDatatable",

    ReadCategoriesAll = "ReadCategoriesAll",
    ReadCategoriesDepartment = "ReadCategoriesDepartment",
    EditCategoriesAll = "EditCategoriesAll",
    EditCategoriesDepartment = "EditCategoriesDepartment",

    ReadCatalogRecords = "ReadCatalogRecords",
    ReviewCatalogRecords = "ReviewCatalogRecords",

    PlanTasks = "PlanTasks",
    AdminTasks = "AdminTasks",

    EditAccess = "EditAccess",
    StopEmulatingAccess = "StopEmulatingAccess",

    Extract = "Extract",
    AdminExtractions = "AdminExtractions",

    AdminDatabase = "AdminDatabase",

    ReadDatatable = "ReadDatatable",
    EditDatatable = "EditDatatable",
    ReadCategories = "ReadCategories",
    EditCategories = "EditCategories",
}

enum ActionScope {
    WithoutScope = "WithoutScope",
    All = "All",
    Department = "Department",
    Own = "Own",
}

export { ActionType, ActionScope };
