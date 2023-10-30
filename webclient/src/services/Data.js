import { Record } from "../models/Record";
import { Role } from "../models/Role";
import { api } from "./Api";

class DataService {
    setError(error) {
        // msgs.current.show(
        //     {sticky: true, severity: 'error', summary: 'Error', detail: 'Message Content', closable: false}
        // );
    }

    async getUsers() {
        try {
            const users = (await api.getUsers()).data;
            return users;
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async updateUser(user) {
        try {
            const updatedUser = await api.updateUser(user);
            return updatedUser;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteUser(user) {
        try {
            const deletedUser = await api.deleteUser(user.id);
            return deletedUser;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async getDepartments() {
        try {
            const departments = (await api.getDepartments()).data;
            return departments;
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createDepartment(department) {
        try {
            const createdDepartment = await api.createDepartment(department);
            return createdDepartment;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateDepartment(department) {
        try {
            const updatedDepartment = await api.updateDepartment(department);
            return updatedDepartment;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteDepartment(department) {
        try {
            const deletedDepartment = await api.deleteDepartment(department.id);
            return deletedDepartment;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async getRolesNames() {
        try {
            const { roles } = (await api.getRoleNames()).data;
            return roles.map(role => role.name);
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async getRoles() {
        try {
            const { roles } = (await api.getRoles()).data;
            return roles.map(role => Role.fromJson(role));
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createRole(role) {
        try {
            const createdRole = await api.createRole(role);
            return createdRole;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateRole(role) {
        try {
            const updatedRole = await api.updateRole(role);
            return updatedRole;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteRole(role) {
        try {
            const deletedRole = await api.deleteRole(role.id);
            return deletedRole;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async getCategories() {
        try {
            const categories = (await api.getCategories()).data;
            return categories;
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createCategory(category) {
        try {
            const createdCategory = await api.createCategory(category);
            return createdCategory;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateCategory(category) {
        try {
            const updatedCategory = await api.updateCategory(category);
            return updatedCategory;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteCategory(category) {
        try {
            const deletedCategory = await api.deleteCategory(category.id);
            return deletedCategory;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async getRecords(offset, rows) {
        try {
            const { records, num_found } = (await api.getRecords(offset, rows)).data;
            return { records: records.map(record => Record.fromJson(record)), num_found };
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createRecord(record) {
        try {
            const createdRecord = await api.createRecord(record);
            return Record.fromJson(createdRecord);
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async createRecordsFromFile(file, category_id) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            console.log(formData);
            const createdRecords = await api.createRecordsFromFile(formData, category_id);
            console.log(createdRecords);
            return createdRecords;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateRecord(record) {
        try {
            const updatedRecord = await api.updateRecord(record);
            return Record.fromJson(updatedRecord);
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteRecord(record) {
        try {
            const deletedRecord = await api.deleteRecord(record.id);
            return Record.fromJson(deletedRecord);
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteRecords(records) {
        const deletedRecords = records.map(record => this.deleteRecord(record));
        return deletedRecords;
    }
};

export const dataService = new DataService();
