import { User } from "../../adapters/ApiUser";
import { RoleModel } from "./RoleModel";

export class UserModel {
    username: string | undefined;
    department_id: number | undefined;
    department_name: string | undefined;
    role_id: number | undefined;
    role_name: string | undefined;
    actions: string[] | undefined;
    isLoggedIn: boolean = false;

    static createUser(userData: User): UserModel {
        const user = new UserModel();
        user.username = userData.username;
        user.department_id = userData.department_id ? userData.department_id : undefined;
        user.department_name = userData.department_name ? userData.department_name : undefined;
        user.role_id = userData.role_id;
        user.role_name = userData.role_name;
        user.actions = RoleModel.expandActions(userData.actions);
        user.isLoggedIn = true;
        return user;
    }

    static createEmptyUser() {
        const user = new UserModel();
        user.isLoggedIn = true;
        return user;
    }
}