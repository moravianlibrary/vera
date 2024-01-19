import { Role } from "./RoleModel";

export class User {
    access_token;
    expires_on;
    username;
    department_name;
    role_name;
    actions;
    isLoggedIn = false;

    static createUser(userData) {
        const user = new User();
        user.username = userData.username;
        user.department_id = userData.department_id;
        user.department_name = userData.department_name;
        user.role_id = userData.role_id;
        user.role_name = userData.role_name;
        user.actions = Role.expandActions(userData.actions);
        user.isLoggedIn = true;
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