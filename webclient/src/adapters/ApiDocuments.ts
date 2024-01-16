import axiosInstance, { authHeader } from "./ApiBase";

interface Document {
    id: number;
    // Add other document properties
    toJson(): object;
}

namespace ApiDocuments {
    export function getDocuments(offset: number, rows: number) {
        return axiosInstance.get<Document[]>(`/documents?offset=${offset}&limit=${rows}`, { headers: authHeader() });
    }

    export function createDocument(document: Document) {
        return axiosInstance.post("/documents", document.toJson(), { headers: authHeader() });
    }

    export function insertDocument(createData: any, insert_digitized: boolean, category_id?: number | null) {
        const url = category_id !== null
            ? `/documents/create_from_catalog?category_id=${category_id}&insert_digitized=${insert_digitized}`
            : `/documents/create_from_catalog?insert_digitized=${insert_digitized}`;

        return axiosInstance.post(url, createData, { headers: authHeader() });
    }

    export function createDocumentsFromFile(formData: FormData, category_id: number) {
        return axiosInstance.post(`/documents_file/${category_id}`, formData, { headers: authHeader('multipart/form-data') });
    }

    export function precreateDocument(identifier_type: string, identifier_value: string) {
        const body = {
            identifier_type: identifier_type,
            value: identifier_value
        };
        return axiosInstance.post(`/documents/precreate_by_identifier`, body, { headers: authHeader() });
    }

    export function updateDocument(document: Document) {
        return axiosInstance.put(`/documents/${document.id}`, document, { headers: authHeader() });
    }

    export function deleteDocument(id: number) {
        return axiosInstance.delete(`/documents/${id}`, { headers: authHeader() });
    }
}

export default ApiDocuments;
