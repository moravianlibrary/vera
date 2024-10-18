import {
    ActionScope,
    ActionType,
    Permission,
    PermissionTypes,
} from "../../types/ActionType";
import { OwnershipActionType, OwnershipType } from "../RoleAction";

class RoleFactory {
    static parseActionsToPermissions(actions: ActionType[]): Permission[] {
        return actions
            .map((action) => {
                if (action.includes("All")) {
                    return [
                        action.replace("All", "") as ActionType,
                        ActionScope.All,
                    ];
                }
                if (action.includes("Department")) {
                    return [
                        action.replace("Department", "") as ActionType,
                        ActionScope.Department,
                    ];
                }
                if (action.includes("Own")) {
                    return [
                        action.replace("Own", "") as ActionType,
                        ActionScope.Own,
                    ];
                }
                return PermissionTypes.includes(action) ? action : null;
            })
            .filter((a) => a !== null) as Permission[];
    }

    static parseReadDatatableAction(
        actions: ActionType[]
    ): OwnershipActionType | null {
        if (actions.includes(ActionType.ReadDatatableAll)) {
            return [ActionType.ReadDatatable, OwnershipType.All];
        }
        if (actions.includes(ActionType.ReadDatatableDepartment)) {
            return [ActionType.ReadDatatable, OwnershipType.Department];
        }
        if (actions.includes(ActionType.ReadDatatableOwn)) {
            return [ActionType.ReadDatatable, OwnershipType.Own];
        }
        return null;
    }

    static parseEditDatatableAction(
        actions: ActionType[]
    ): OwnershipActionType | null {
        if (actions.includes(ActionType.EditDatatableAll)) {
            return [ActionType.EditDatatable, OwnershipType.All];
        }
        if (actions.includes(ActionType.EditDatatableDepartment)) {
            return [ActionType.EditDatatable, OwnershipType.Department];
        }
        if (actions.includes(ActionType.EditDatatableOwn)) {
            return [ActionType.EditDatatable, OwnershipType.Own];
        }
        return null;
    }

    static parseReadCategoriesAction(
        actions: ActionType[]
    ): OwnershipActionType | null {
        if (actions.includes(ActionType.ReadCategoriesAll)) {
            return [ActionType.ReadCategories, OwnershipType.All];
        }
        if (actions.includes(ActionType.ReadCategoriesDepartment)) {
            return [ActionType.ReadCategories, OwnershipType.Department];
        }
        return null;
    }

    static parseEditCategoriesAction(
        actions: ActionType[]
    ): OwnershipActionType | null {
        if (actions.includes(ActionType.EditCategoriesAll)) {
            return [ActionType.EditCategories, OwnershipType.All];
        }
        if (actions.includes(ActionType.EditCategoriesDepartment)) {
            return [ActionType.EditCategories, OwnershipType.Department];
        }
        return null;
    }

    static parseReadDatatableOwnershipAction(
        action: OwnershipActionType | null
    ): ActionType | null {
        if (action === null || action[0] !== ActionType.ReadDatatable) {
            return null;
        }
        switch (action[1]) {
            case OwnershipType.All:
                return ActionType.ReadDatatableAll;
            case OwnershipType.Department:
                return ActionType.ReadDatatableDepartment;
            case OwnershipType.Own:
                return ActionType.ReadDatatableOwn;
            default:
                return null;
        }
    }

    static parseEditDatatableOwnershipAction(
        action: OwnershipActionType | null
    ): ActionType | null {
        if (action === null || action[0] !== ActionType.EditDatatable) {
            return null;
        }
        switch (action[1]) {
            case OwnershipType.All:
                return ActionType.EditDatatableAll;
            case OwnershipType.Department:
                return ActionType.EditDatatableDepartment;
            case OwnershipType.Own:
                return ActionType.EditDatatableOwn;
            default:
                return null;
        }
    }

    static parseReadCategoriesOwnershipAction(
        action: OwnershipActionType | null
    ): ActionType | null {
        if (action === null || action[0] !== ActionType.ReadCategories) {
            return null;
        }
        switch (action[1]) {
            case OwnershipType.All:
                return ActionType.ReadCategoriesAll;
            case OwnershipType.Department:
                return ActionType.ReadCategoriesDepartment;
            default:
                return null;
        }
    }

    static parseEditCategoriesOwnershipAction(
        action: OwnershipActionType | null
    ): ActionType | null {
        if (action === null || action[0] !== ActionType.EditCategories) {
            return null;
        }
        switch (action[1]) {
            case OwnershipType.All:
                return ActionType.EditCategoriesAll;
            case OwnershipType.Department:
                return ActionType.EditCategoriesDepartment;
            default:
                return null;
        }
    }
}

export default RoleFactory;
