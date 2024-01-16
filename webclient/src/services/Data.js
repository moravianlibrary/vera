import { Category } from "../categories/models/Category";
import { Quota } from "../categories/models/Quota";
import { PrecreateDocument } from "../documents/models/PrecreateDocument";
import { Document } from "../documents/models/Document";
import { Role } from "../contexts/user/RoleModel";
import { DocumentResult } from "../documents/models/DocumentResult";
import { createContext, useContext } from "react";
import Identifier from "../documents/models/Identifier";
import CreateResult from "../documents/models/CreateResult";
import ApiUser from "../adapters/ApiUser";
import ApiDepartments from "../adapters/ApiDepartments";
import ApiRoles from "../adapters/ApiRoles";
import ApiCategories from "../adapters/ApiCategories";
import ApiDocuments from "../adapters/ApiDocuments";

class DataService {
    constructor() {
        this.listeners = new Set();

        this.multiIssueDocuments = [];
    }

    subscribe(eventName, listener) {
        this.listeners.add({ eventName, listener });
        document.addEventListener(eventName, listener);
    }

    unsubscribe(eventName, listener) {
        this.listeners.delete({ eventName, listener });
    }

    publish(eventName, eventData = null) {
        this.listeners.forEach(({ eventName: listenerEventName, listener }) => {
            if (eventName === listenerEventName) {
                listener(eventData);
            }
        });
    }

    setError(error) {
        // msgs.current.show(
        //     {sticky: true, severity: 'error', summary: 'Error', detail: 'Message Content', closable: false}
        // );
    }

    async getDepartments() {
        try {
            const departments = (await ApiDepartments.getDepartments()).data;
            return departments;
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createDepartment(department) {
        try {
            const createdDepartment = await ApiDepartments.createDepartment(department);
            return createdDepartment;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateDepartment(department) {
        try {
            const updatedDepartment = await ApiDepartments.updateDepartment(department);
            return updatedDepartment;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteDepartment(department) {
        try {
            const deletedDepartment = await ApiDepartments.deleteDepartment(department.id);
            return deletedDepartment;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async getRolesNames() {
        try {
            const roles = (await ApiRoles.getRoleNames()).data;
            return roles.map(role => role.name);
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async getRoles() {
        try {
            const roles = (await ApiRoles.getRoles()).data;
            return roles.map(role => Role.fromJson(role));
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createRole(role) {
        try {
            const createdRole = await ApiRoles.createRole(role);
            return createdRole;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateRole(role) {
        try {
            const updatedRole = await ApiRoles.updateRole(role);
            return updatedRole;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteRole(role) {
        try {
            const deletedRole = await ApiRoles.deleteRole(role.id);
            return deletedRole;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async getCategories() {
        try {
            const categories = (await ApiCategories.getCategories()).data;
            return categories.map(category => Category.fromJson(category));
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async getAssignableCategories() {
        try {
            const categories = (await ApiCategories.getAssignableCategories()).data;
            return categories.map(category => Category.fromJson(category));
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async getRootCategories() {
        try {
            const categories = (await ApiCategories.getRootCategories()).data;
            return categories.map(category => Category.fromJson(category));
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createCategory(category) {
        try {
            const createdCategory = await ApiCategories.createCategory(category);
            return createdCategory;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateCategory(category) {
        try {
            const updatedCategory = await ApiCategories.updateCategory(category);
            return updatedCategory;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteCategory(category) {
        try {
            const deletedCategory = await ApiCategories.deleteCategory(category.id);
            return deletedCategory;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateDistribution(parent_id, distribution) {
        try {
            const result = await ApiCategories.updateDistribution(parent_id, distribution);
            return result.status === 200;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async getQuotas() {
        try {
            const quotas = (await ApiCategories.getQuotas()).data;
            return quotas.map(quota => Quota.fromJson(quota));
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createQuota(quota) {
        try {
            const createdQuota = (await ApiCategories.createQuota(quota)).data;
            return createdQuota;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateQuota(quota) {
        try {
            const updatedQuota = (await ApiCategories.updateQuota(quota)).data;
            return updatedQuota;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteQuota(quota) {
        try {
            const deletedQuota = (await ApiCategories.deleteQuota(quota.id)).data;
            return deletedQuota;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async getDocuments(offset, rows) {
        try {
            const { documents, num_found } = (await ApiDocuments.getDocuments(offset, rows)).data;
            return { documents: documents.map(document => Document.fromJson(document)), num_found };
        } catch (error) {
            this.setError(error);
            return [];
        }
    }

    async createDocument(document) {
        try {
            const createdDocument = await ApiDocuments.createDocument(document);
            return Document.fromJson(createdDocument);
        } catch (error) {
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
            const newDocument = await ApiDocuments.insertDocument(createData, insert_digitized, category_id);
            return DocumentResult.fromJson(newDocument.data);
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async createDocumentsFromFile(file, category_id) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const createdDocuments = await ApiDocuments.createDocumentsFromFile(formData, category_id);
            return createdDocuments;
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async precreateDocument(identifier_type, identifier_value) {
        try {
            const { data }= await ApiDocuments.precreateDocument(identifier_type, identifier_value);
            return PrecreateDocument.fromJson(data);
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async updateDocument(document) {
        try {
            const updatedDocument = await ApiDocuments.updateDocument(document);
            return Document.fromJson(updatedDocument);
        } catch (error) {
            this.setError(error);
            return null;
        }
    }

    async deleteDocument(document) {
        try {
            const deletedDocument = await ApiDocuments.deleteDocument(document.id);
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

    setMultiIssueDocuments(multiIssueDocuments) {
        this.multiIssueDocuments = multiIssueDocuments;
        this.publish('multiIssueDocumentsChanged');
    }

    hasMultiIssueDocument() {
        return this.multiIssueDocuments?.length > 0;
    }

    getMultiIssueDocument() {
        return this.multiIssueDocuments[0];
    }

    async selectFromMultiIssueDocument(selectedIssue, category) {
        let editedIssues = this.multiIssueDocuments[0].catalog_document.issues.map(issue => {
            if (issue.barcode === selectedIssue.barcode) {
                return {
                    ...issue,
                    creating: true
                }
            } else {
                return issue;
            }
        });
        this.multiIssueDocuments[0].catalog_document.issues = editedIssues;
        this.publish('multiIssueDocumentsChanged');

        const result = await this.insertDocument(Identifier.BARCODE, selectedIssue.barcode, category, false);

        editedIssues = this.multiIssueDocuments[0].catalog_document.issues.map(issue => {
            if (issue.barcode === selectedIssue.barcode) {
                console.log(issue);
                return {
                    ...issue,
                    creating: false,
                    already_exists: result.create_result === CreateResult.SUCCESS
                }
            } else {
                return issue;
            }
        });
        this.multiIssueDocuments[0].catalog_document.issues = editedIssues;
        this.publish('multiIssueDocumentsChanged');
    }
};

const dataService = new DataService();
const DataContext = createContext();

export const DataProvider = ({ children }) => {
    return (
        <DataContext.Provider value={{ dataService }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
