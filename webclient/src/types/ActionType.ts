enum ActionType {
    ReadDatatable = "ReadDatatable",
    ReadDatatableOwn = "ReadDatatableOwn",
    ReadDatatableDepartment = "ReadDatatableDepartment",
    ReadDatatableAll = "ReadDatatableAll",
    EditDatatable = "EditDatatable",
    EditDatatableOwn = "EditDatatableOwn",
    EditDatatableDepartment = "EditDatatableDepartment",
    EditDatatableAll = "EditDatatableAll",
    WriteDatatable = "WriteDatatable",
    InsertDatatable = "InsertDatatable",
    CommentOnDatatable = "CommentOnDatatable",

    ReadCategories = "ReadCategories",
    ReadCategoriesAll = "ReadCategoriesAll",
    ReadCategoriesDepartment = "ReadCategoriesDepartment",
    EditCategories = "EditCategories",
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
}

enum ActionScope {
    None = "None",
    Own = "Own",
    Department = "Department",
    All = "All",
}

type SimplePermission = ActionType;
type ScopePermission = [ActionType, ActionScope];
type Permission = SimplePermission | ScopePermission;

const PermissionTypes: ActionType[] = [
    ActionType.ReadDatatable,
    ActionType.EditDatatable,
    ActionType.InsertDatatable,
    ActionType.ReadCategories,
    ActionType.EditCategories,
    ActionType.ReadCatalogRecords,
    ActionType.ReviewCatalogRecords,
    ActionType.PlanTasks,
    ActionType.AdminTasks,
    ActionType.Extract,
    ActionType.AdminExtractions,
    ActionType.EditAccess,
];

const SimplePermissions: Permission[] = [
    ActionType.InsertDatatable,
    ActionType.ReadCatalogRecords,
    ActionType.ReviewCatalogRecords,
    ActionType.PlanTasks,
    ActionType.AdminTasks,
    ActionType.Extract,
    ActionType.AdminExtractions,
    ActionType.EditAccess,
];

const ScopePermissions: Permission[] = [
    ActionType.ReadDatatable,
    ActionType.EditDatatable,
    ActionType.ReadCategories,
    ActionType.EditCategories,
];

const Permissions: Permission[] = [
    [ActionType.ReadDatatable, ActionScope.All],
    [ActionType.ReadDatatable, ActionScope.Department],
    [ActionType.ReadDatatable, ActionScope.Own],
    [ActionType.EditDatatable, ActionScope.All],
    [ActionType.EditDatatable, ActionScope.Department],
    [ActionType.EditDatatable, ActionScope.Own],
    ActionType.InsertDatatable,
    [ActionType.ReadCategories, ActionScope.All],
    [ActionType.ReadCategories, ActionScope.Department],
    [ActionType.EditCategories, ActionScope.All],
    [ActionType.EditCategories, ActionScope.Department],
    ActionType.ReadCatalogRecords,
    ActionType.ReviewCatalogRecords,
    ActionType.PlanTasks,
    ActionType.AdminTasks,
    ActionType.Extract,
    ActionType.AdminExtractions,
    ActionType.EditAccess,
];

const PermissionIndex = Object.values(ActionType).reduce(
    (acc, permission, index) => {
        acc[permission] = index;
        return acc;
    },
    {} as Record<ActionType, number>
);

const compare = (a: ActionType, b: ActionType) => {
    return (
        PermissionIndex[Array.isArray(a) ? a[0] : a] -
        PermissionIndex[Array.isArray(b) ? b[0] : b]
    );
};

const ValidScopesDispatcher = (p: ActionType): ActionScope[] => {
    switch (p) {
        case ActionType.ReadDatatable:
        case ActionType.EditDatatable:
            return [
                ActionScope.None,
                ActionScope.Own,
                ActionScope.Department,
                ActionScope.All,
            ];
        case ActionType.ReadCategories:
        case ActionType.EditCategories:
            return [ActionScope.None, ActionScope.Department, ActionScope.All];
        default:
            return [];
    }
};

export {
    ActionType,
    ActionScope,
    Permissions,
    PermissionTypes,
    ScopePermissions,
    SimplePermissions,
    compare,
    ValidScopesDispatcher,
};
export type { SimplePermission, Permission, ScopePermission };
