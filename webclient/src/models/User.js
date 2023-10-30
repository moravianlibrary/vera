import { Role } from "./Role";

export class User {
    access_token;
    expires_on;
    id;
    username;
    department_id;
    role_id;
    department_abbreviaion;
    department_name;
    role_name;
    actions;

    setUserData(userData) {
        this.id = userData.id;
        this.username = userData.username;
        this.department_id = userData.department_id;
        this.role_id = userData.role_id;
        this.department_abbreviaion = userData.department_abbreviaion;
        this.department_name = userData.department_name;
        this.role_name = userData.role_name;
        this.actions = Role.expandActions(userData.actions);
    }

    static fromToken(tokenData) {
        const user = new User();
        user.access_token = tokenData.access_token;
        user.expires_on = tokenData.expires_on;
        return user;
    }

    static fromJson(json) {
        const user = new User();

        user.access_token = json.access_token;
        user.expires_on = json.expires_on;
        user.id = json.id;
        user.username = json.username;
        user.department_id = json.department_id;
        user.role_id = json.role_id;
        user.department_abbreviaion = json.department_abbreviaion;
        user.department_name = json.department_name;
        user.role_name = json.role_name;
        user.actions = json.actions;

        return user;
    }
};