import { ApiBase, ApiOptions } from "./ApiBase";

interface Department {
    id: number;
    name: string;
    abbreviation: string;
    usernames: string[];
}

class ApiDepartments extends ApiBase<Department> {
    constructor() {
        super("/departments", {
            disableGet: true,
        } as ApiOptions);
    }
}

export default ApiDepartments;
export type { Department };
