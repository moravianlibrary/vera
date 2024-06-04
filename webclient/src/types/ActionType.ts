enum ActionType {
    ReadDatatableOwn = 'ReadDatatableOwn',
    ReadDatatableDepartment = 'ReadDatatableDepartment',
    ReadDatatableAll = 'ReadDatatableAll',
    EditDatatableOwn = 'EditDatatableOwn',
    EditDatatableDepartment = 'EditDatatableDepartment',
    EditDatatableAll = 'EditDatatableAll',
    WriteDatatable = 'WriteDatatable',
    InsertDatatable = 'InsertDatatable',
    CommentOnDatatable = 'CommentOnDatatable',

    ReadCategoriesAll = 'ReadCategoriesAll',
    ReadCategoriesDepartment = 'ReadCategoriesDepartment',
    EditCategoriesAll = 'EditCategoriesAll',
    EditCategoriesDepartment = 'EditCategoriesDepartment',

    PlanTasks = 'PlanTasks',
    AdminTasks = 'AdminTasks',

    EditAccess = 'EditAccess',
    StopEmulatingAccess = "StopEmulatingAccess",

    Extract = 'Extract',
    AdminExtractions = 'AdminExtractions',

    AdminDatabase = 'AdminDatabase',

    ReadDatatable = 'ReadDatatable',
    EditDatatable = 'EditDatatable',
    ReadCategories = 'ReadCategories',
    EditCategories = 'EditCategories',
}

export { ActionType };
