import Axios from "axios";

import authHeader from "./AccessService";
import { APP_CONFIG } from "../config/config";

const axios = Axios.create({
    baseURL: `${APP_CONFIG.base_url}`,
    headers: { "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    },
});

class Api {
    getCurrentUser() {
        return axios.get(`/auth/current_user`, { headers: authHeader() });
    }

    getDepartments() {
        return axios.get(`/departments`, { headers: authHeader() });
    }

    createDepartment(department) {
        return axios.post(`/departments`, department, { headers: authHeader() });
    }

    updateDepartment(department) {
        return axios.put(`/departments/${department.id}`, department, { headers: authHeader() });
    }

    deleteDepartment(id) {
        return axios.delete(`/departments/${id}`, { headers: authHeader() });
    }

    getRoleNames() {
        return axios.get(`/roles_names`, { headers: authHeader() });
    }

    getRoles() {
        return axios.get(`/roles`, { headers: authHeader() });
    }

    createRole(role) {
        return axios.post(`/roles`, role.toJson(), { headers: authHeader() });
    }

    updateRole(role) {
        return axios.put(`/roles/${role.id}`, role.toJson(), { headers: authHeader() });
    }

    deleteRole(id) {
        return axios.delete(`/roles/${id}`, { headers: authHeader() });
    }

    getCategories() {
        return axios.get(`/categories`, { headers: authHeader() });
    }

    getAssignableCategories() {
        return axios.get(`/categories/descriptors?assignable=true`, { headers: authHeader() });
    }

    getRootCategories() {
        return axios.get(`/categories/descriptors?root=true`, { headers: authHeader() });
    }

    createCategory(category) {
        return axios.post(`/categories/category`, category.toJson(), { headers: authHeader() });
    }

    updateCategory(category) {
        return axios.put(`/categories/category/${category.id}`, category.toJson(), { headers: authHeader() });
    }

    deleteCategory(id) {
        return axios.delete(`/categories/category/${id}`, { headers: authHeader() });
    }

    updateDistribution(parent_id, distribution) {
        if (parent_id) {
            return axios.put(`/categories/distribution?parent_id=${parent_id}`, distribution, { headers: authHeader() });
        }
        return axios.put(`/categories/distribution`, distribution, { headers: authHeader() });
    }

    getQuotas() {
        return axios.get(`/categories/quota`, { headers: authHeader() });
    }

    createQuota(quota) {
        console.log(quota);
        return axios.post(`/categories/quota`, quota, { headers: authHeader() });
    }

    updateQuota(quota) {
        console.log(quota);
        return axios.put(`/categories/quota/${quota.id}`, quota, { headers: authHeader() });
    }

    deleteQuota(id) {
        return axios.delete(`/categories/quota/${id}`, { headers: authHeader() });
    }

    getDocuments(offset, rows) {
        return axios.get(`/documents?offset=${offset}&limit=${rows}`, { headers: authHeader() });
    }

    createDocument(document) {
        return axios.post(`/documents`, document.toJson(), { headers: authHeader() });
    }

    insertDocument(createData, category_id, insert_digitized) {
        return axios.post(
            `/documents/create_from_catalog?category_id=${category_id}&insert_digitized=${insert_digitized}`,
            createData, { headers: authHeader() });
    }

    insertDocument(createData, insert_digitized) {
        return axios.post(
            `/documents/create_from_catalog?insert_digitized=${insert_digitized}`,
            createData, { headers: authHeader() });
    }

    createDocumentsFromFile(formData, category_id) {
        return axios.post(`/documents_file/${category_id}`, formData, { headers: authHeader('multipart/form-data') });
    }

    precreateDocument(identifier_type, identifier_value) {
        const body = {
            identifier_type: identifier_type,
            value: identifier_value
        }
        return axios.post(`/documents/precreate_by_identifier`, body, { headers: authHeader() });
    }

    updateDocument(document) {
        return axios.put(`/documents/${document.id}`, document, { headers: authHeader() });
    }

    deleteDocument(id) {
        return axios.delete(`/documents/${id}`, { headers: authHeader() });
    }
}

export const api = new Api();
