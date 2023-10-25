import { Record } from "../models/Record";
import { Role } from "../models/Role";
import { api } from "./Api";
// import { msgs } from '../views/App';

class DataService {
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
            const { roles } = await api.getRoleNames();
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

    async getCategories() {
        try {
            const categories = await api.getCategories();
            return categories;
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

    async getRecords(offset, rows) {
        try {
            const { records, num_found } = await api.getRecords(offset, rows);
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
