import { Department } from "../../adapters/ApiDepartments";

export class DepartmentModel implements Department {
    id?: number;
    name: string;
    abbreviation: string;
    users: string[];

    constructor(data: Department) {
        this.id = data.id;
        this.name = data.name;
        this.abbreviation = data.abbreviation;
        this.users = data.users;

    }
    static createEmpty() {
        return new DepartmentModel({
            name: '',
            abbreviation: '',
            users: []
        });
    }
}