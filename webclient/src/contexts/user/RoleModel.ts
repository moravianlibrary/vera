import { Role } from "../../adapters/ApiRoles";
import { ActionType } from "../../types/ActionType";

export class RoleModel implements Role {
    id?: number;
    name: string;
    actions: ActionType[];

    constructor(data: Role) {
        this.id = data.id;
        this.name = data.name;
        this.actions = data.actions;
    }

    static createEmpty() {
        return new RoleModel({
            name: "",
            actions: []
        });
    }

    setName(name: string) {
        this.name = name;
    }

    addAction(action: ActionType) {
        this.actions = [...this.actions, action];
    }

    removeAction(action: ActionType) {
        this.actions = this.actions.filter(a => a !== action);
    }

    canEdit() {
        return this.name !== "Admin";
    }

    static expandActions(actions: ActionType[]): ActionType[] {
        if (actions.includes(ActionType.ReadDatatableOwn)
                || actions.includes(ActionType.ReadDatatableDepartment)
                || actions.includes(ActionType.ReadDatatableAll)) {
            actions = [...actions, ActionType.ReadDatatable];
        }
        if (actions.includes(ActionType.ReadCategoriesDepartment)
                || actions.includes(ActionType.ReadCategoriesAll)) {
            actions = [...actions, ActionType.ReadCategories];
        }
        return actions;
    }
}
