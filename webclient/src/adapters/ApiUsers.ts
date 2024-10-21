import axiosInstance, { ApiBase, authHeader } from "./ApiBase";
import { ActionScope, ActionType } from "../types/ActionType";

interface UserSettings {
    [key: string]: any;
}

interface CurrentUser {
    username: string;
    settings: UserSettings;
    role_id: number;
    role_name: string;
    // actions: (ActionType | [ActionType, ActionScope])[];
    actions: ActionType[];
    department_id: number | null;
    department_name: string | null;
    department_categories_ids: number[] | null;
}

interface User {
    username: string;
}

class ApiUsers extends ApiBase<User> {
    constructor() {
        super("/users", {
            disableGet: true,
            disableCreate: true,
            disableUpdate: true,
            disableDelete: true,
        });
    }

    getCurrentUser() {
        return axiosInstance.get<CurrentUser>(`${this.endpoint}/current`, {
            headers: this.authHeader(),
        });
    }

    setUserSettings(settings: UserSettings) {
        return axiosInstance.post<CurrentUser>(
            `${this.endpoint}/current/settings`,
            settings,
            { headers: this.authHeader() }
        );
    }

    emulateAccess(actions: ActionType[]) {
        return axiosInstance.post<CurrentUser>(
            `${this.endpoint}/current/emulate`,
            { actions },
            { headers: this.authHeader() }
        );
    }

    endAccessEmulation() {
        return axiosInstance.delete<CurrentUser>(
            `${this.endpoint}/current/emulate`,
            { headers: this.authHeader() }
        );
    }
}

export default ApiUsers;
export type { CurrentUser, User };
