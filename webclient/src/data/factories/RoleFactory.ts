import { ActionType } from "../../types/ActionType";
import { OwnershipActionType, OwnershipType } from "../RoleAction";

class RoleFactory {
    static parseReadDatatableAction(actions: ActionType[]): OwnershipActionType | null {
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

    static parseEditDatatableAction(actions: ActionType[]): OwnershipActionType | null {
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

    static parseReadCategoriesAction(actions: ActionType[]): OwnershipActionType | null {
        if (actions.includes(ActionType.ReadCategoriesAll)) {
            return [ActionType.ReadCategories, OwnershipType.All];
        }
        if (actions.includes(ActionType.ReadCategoriesDepartment)) {
            return [ActionType.ReadCategories, OwnershipType.Department];
        }
        return null;
    }

    static parseEditCategoriesAction(actions: ActionType[]): OwnershipActionType | null {
        if (actions.includes(ActionType.EditCategoriesAll)) {
            return [ActionType.EditCategories, OwnershipType.All];
        }
        if (actions.includes(ActionType.EditCategoriesDepartment)) {
            return [ActionType.EditCategories, OwnershipType.Department];
        }
        return null;
    }
}

export default RoleFactory;
