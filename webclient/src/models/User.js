import { Role } from "./Role";

export class User {
    access_token;
    expires_on;
    username;
    department_name;
    role_name;
    actions;

    static createUser(userData) {
        const user = new User();
        this.username = userData.username;
        this.department_id = userData.department_id;
        this.department_name = userData.department_name;
        this.role_id = userData.role_id;
        this.role_name = userData.role_name;
        this.actions = Role.expandActions(userData.actions);
        return user;
    }

    static fromJson(json) {
        const user = new User();

        user.username = json.username;
        user.department_id = json.department_id;
        user.department_name = json.department_name;
        user.role_id = json.role_id;
        user.role_name = json.role_name;
        user.actions = json.actions;

        return user;
    }
};