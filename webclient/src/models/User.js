import { Role } from "./Role";

export class User {
    access_token;
    expires_on;
    username;
    department_name;
    role_name;
    actions;

    static createUser(access_token, expires_on, userData) {
        const user = new User();
        user.access_token = access_token;
        user.expires_on = expires_on;
        this.username = userData.username;
        this.department_abbreviaion = userData.department_abbreviaion;
        this.department_name = userData.department_name;
        this.role_name = userData.role_name;
        this.actions = Role.expandActions(userData.actions);
        return user;
    }

    static fromJson(json) {
        const user = new User();

        user.access_token = json.access_token;
        user.expires_on = json.expires_on;
        user.username = json.username;
        user.department_abbreviaion = json.department_abbreviaion;
        user.department_name = json.department_name;
        user.role_name = json.role_name;
        user.actions = json.actions;

        return user;
    }
};