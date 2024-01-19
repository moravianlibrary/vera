import { Role } from "../adapters/ApiRoles";
import { ActionType } from "./ActionType";

export class RoleModel implements Role {
    id?: number;
    name: string;
    actions: ActionType[];

    read_datatable_level: number | undefined;
    edit_datatable_level: number | undefined;
    write_datatable: boolean | undefined;
    comment_on_datatable: boolean | undefined;
    edit_access: boolean | undefined;
    edit_categories: boolean | undefined;
    extract: boolean | undefined;

    constructor(data: Role) {
        this.id = data.id;
        this.name = data.name;
        this.actions = data.actions;

        this.read_datatable_level = data.actions.includes(ActionType.ReadDatatableAll) ? 3
                : data.actions.includes(ActionType.ReadDatatableDepartment) ? 2
                : data.actions.includes(ActionType.ReadDatatableOwn) ? 1
                : 0;
        this.edit_datatable_level = data.actions.includes(ActionType.EditDatatableAll) ? 3
                : data.actions.includes(ActionType.EditDatatableDepartment) ? 2
                : data.actions.includes(ActionType.EditDatatableOwn) ? 1
                : 0;
        this.write_datatable = data.actions.includes(ActionType.WriteDatatable);
        this.comment_on_datatable = data.actions.includes(ActionType.CommentOnDatatable);
        this.edit_access = data.actions.includes(ActionType.EditAccess);
        this.edit_categories = data.actions.includes(ActionType.EditCategories);
        this.extract = data.actions.includes(ActionType.Extract);
    }

    toJson(): any {
        const actionsValues = Object.values(ActionType);
        const actions = [
            this.read_datatable_level === 1,
            this.read_datatable_level === 2,
            this.read_datatable_level === 3,
            this.edit_datatable_level === 1,
            this.edit_datatable_level === 2,
            this.edit_datatable_level === 3,
            this.write_datatable,
            this.comment_on_datatable,
            this.edit_access,
            this.edit_categories,
            this.extract,
        ].map((enabled, index) => enabled ? actionsValues[index] : null)
        .filter((item) => item !== null);

        return {
            id: this.id,
            name: this.name,
            actions: actions
        };
    }

    static expandActions(actions: string[]): string[] {
        if (actions.includes(ActionType.ReadDatatableAll)) {
            actions = [...actions, ActionType.ReadDatatableDepartment];
        }
        if (actions.includes(ActionType.ReadDatatableDepartment)) {
            actions = [...actions, ActionType.ReadDatatableOwn];
        }
        if (actions.includes(ActionType.EditDatatableAll)) {
            actions = [...actions, ActionType.EditDatatableDepartment];
        }
        if (actions.includes(ActionType.EditDatatableDepartment)) {
            actions = [...actions, ActionType.EditDatatableOwn];
        }
        return actions;
    }
}
