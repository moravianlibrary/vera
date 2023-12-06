import { Category } from "../categories/models/Category";
import { Quota } from "../categories/models/Quota";
import { PrecreateDocument } from "../documents/models/PrecreateDocument";
import { Document } from "../documents/models/Document";
import { Role } from "../models/Role";
import { api } from "./Api";
import { DocumentResult } from "../documents/models/DocumentResult";

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
            return categories.map(category => Category.fromJson(category));
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async getAssignableCategories() {
        try {
            const categories = (await api.getAssignableCategories()).data;
            console.log(categories);
            return categories.map(category => Category.fromJson(category));
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async getRootCategories() {
        try {
            const categories = (await api.getRootCategories()).data;
            return categories.map(category => Category.fromJson(category));
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

    async updateDistribution(parent_id, distribution) {
        try {
            const result = await api.updateDistribution(parent_id, distribution);
            return result.status === 200;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async getQuotas() {
        try {
            const quotas = (await api.getQuotas()).data;
            return quotas.map(quota => Quota.fromJson(quota));
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createQuota(quota) {
        try {
            const createdQuota = (await api.createQuota(quota)).data;
            return createdQuota;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateQuota(quota) {
        try {
            const updatedQuota = (await api.updateQuota(quota)).data;
            return updatedQuota;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteQuota(quota) {
        try {
            const deletedQuota = (await api.deleteQuota(quota.id)).data;
            return deletedQuota;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async getDocuments(offset, rows) {
        try {
            const { documents, num_found } = (await api.getDocuments(offset, rows)).data;
            return { documents: documents.map(document => Document.fromJson(document)), num_found };
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createDocument(document) {
        try {
            const createdDocument = await api.createDocument(document);
            return Document.fromJson(createdDocument);
        } catch (error) {
            console.log(error);
            this.setError(error);
            return null;
        }
    }

    async insertDocument(identifier, value, category_id, insert_digitized) {
        try {
            const createData = {
                identifier_type: identifier,
                value: value
            };
            const newDocument = category_id ? await api.insertDocument(createData, category_id, insert_digitized)
                    : await api.insertDocument(createData, insert_digitized);
            return DocumentResult.fromJson(newDocument.data);
        } catch (error) {
            console.log(error);
            this.setError(error);
            return null;
        }
    }
    async createDocumentsFromFile(file, category_id) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const createdDocuments = await api.createDocumentsFromFile(formData, category_id);
            return createdDocuments;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async precreateDocument(identifier_type, identifier_value) {
        try {
            const { data }= await api.precreateDocument(identifier_type, identifier_value);
            return PrecreateDocument.fromJson(data);
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateDocument(document) {
        try {
            const updatedDocument = await api.updateDocument(document);
            return Document.fromJson(updatedDocument);
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteDocument(document) {
        try {
            const deletedDocument = await api.deleteDocument(document.id);
            return Document.fromJson(deletedDocument);
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteDocuments(documents) {
        const deletedDocuments = documents.map(document => this.deleteDocument(document));
        return deletedDocuments;
    }
};

export const dataService = new DataService();
