import { PrecreateDocument } from "../documents/models/PrecreateDocument";
import { Document } from "../documents/models/Document";
import { DocumentResult } from "../documents/models/DocumentResult";
import { createContext, useContext } from "react";
import Identifier from "../documents/models/Identifier";
import CreateResult from "../documents/models/CreateResult";
import ApiUser from "../adapters/ApiUser";
import ApiDepartments from "../adapters/ApiDepartments";
import ApiRoles from "../adapters/ApiRoles";
import ApiCategories from "../adapters/ApiCategories";
import ApiDocuments from "../adapters/ApiDocuments";
import { RoleModel } from "../contexts/user/RoleModel";

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
            return roles.map(role => new RoleModel(role));
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
