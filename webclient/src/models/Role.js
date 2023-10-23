const ActionType = {
    read_datatable_own: 'read_datatable_own',
    read_datatable_department: 'read_datatable_department',
    read_datatable_all: 'read_datatable_all',
    edit_datatable_own: 'edit_datatable_own',
    edit_datatable_department: 'edit_datatable_department',
    edit_datatable_all: 'edit_datatable_all',
    write_datatable: 'write_datatable',
    comment_on_datatable: 'comment_on_datatable',
    edit_access: 'edit_access',
    edit_categories: 'edit_categories',
    extract: 'extract',
};

export class Role {
    id;
    name;

    read_datatable_level;
    edit_datatable_level;

    constructor() {
    }

    static fromJson(jsonData) {
        const role = new Role();

        role.id = jsonData.id;
        role.name = jsonData.name;
        role.actions = jsonData.actions;

        role.read_datatable_level = jsonData.actions.includes(ActionType.read_datatable_all) ? 3
                : jsonData.actions.includes(ActionType.read_datatable_department) ? 2
                : jsonData.actions.includes(ActionType.read_datatable_department) ? 1
                : 0;
        role.edit_datatable_level = jsonData.actions.includes(ActionType.edit_datatable_all) ? 3
                : jsonData.actions.includes(ActionType.edit_datatable_department) ? 2
                : jsonData.actions.includes(ActionType.edit_datatable_department) ? 1
                : 0;
        role.write_datatable = jsonData.actions.includes(ActionType.write_datatable);
        role.comment_on_datatable = jsonData.actions.includes(ActionType.comment_on_datatable);
        role.edit_access = jsonData.actions.includes(ActionType.edit_access);
        role.edit_categories = jsonData.actions.includes(ActionType.edit_categories);
        role.extract = jsonData.actions.includes(ActionType.extract);

        return role;
    }

    toJson() {
        const actionsValues = Object.values(ActionType);
        const actions = [
            this.read_datatable_level == 1,
            this.read_datatable_level == 2,
            this.read_datatable_level == 3,
            this.edit_datatable_level == 1,
            this.edit_datatable_level == 2,
            this.edit_datatable_level == 3,
            this.write_datatable,
            this.comment_on_datatable,
            this.edit_access,
            this.edit_categories,
            this.extract
        ].map((enabled, index) =>
            enabled ? actionsValues[index] : null
        ).filter((item) => item !== null);
        return {
            id: this.id,
            name: this.name,
            actions: actions
        };
    }
}