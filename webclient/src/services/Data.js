import { Role } from "../models/Role";
import { api } from "./Api";
// import { msgs } from '../views/App';

class Data {
    setError(error) {
        // msgs.current.show(
        //     {sticky: true, severity: 'error', summary: 'Error', detail: 'Message Content', closable: false}
        // );
    }

    async getRoles() {
        try {
            const result = await api.getRoles();
            return result.roles.map(role => Role.fromJson(role));
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async getRolesNames() {
        try {
            const { roles }= await api.getRoleNames();
            return roles.map(role => role.name);
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async getDepartments() {
        try {
            const departments = await api.getDepartments();
            return departments;
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async getDepartmentsAbbreviations() {
        try {
            const { departments } = await api.getDepartments();
            return departments.map(department => department.abbreviation);
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async getUsers() {
        try {
            const users = await api.getUsers();
            return users;
        } catch (error) {
            this.setError(error);
            return [];
        }
    }
};

export const data = new Data();
