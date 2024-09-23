import { ApiBase } from "./ApiBase";
import { ActionType } from "../types/ActionType";

interface Role {
    id: number;
    name: string;
    actions: ActionType[];
}

class ApiRoles extends ApiBase<Role> {
    constructor() {
        super("/roles");
    }
}

export default ApiRoles;
export type { Role };
