import Axios from "axios";

import authHeader from "./Auth";
import { APP_CONFIG } from "../config/config";

const axios = Axios.create({
    baseURL: `${APP_CONFIG.base_url}`,
    headers: { "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    },
});

class Api {
    createUser(username, password) {
        console.log(`BaseURL: ${APP_CONFIG.base_url}, EndPoint: /auth/register, HttpMethod: POST`);
        return axios.post(`/auth/register`, {
            username: username,
            password: password
        });
    }

    getToken(username, password) {
        return axios.post(`/auth/login`, {
            username: username,
            password: password
        });
    }

    getCurrentUser() {
        return axios.get(`/auth/current_user`, { headers: authHeader() });
    }

    getUsers() {
        return axios.get(`/users`, { headers: authHeader() });
    }

    updateUser(user) {
        return axios.put(`/users/${user.id}`, user, { headers: authHeader() });
    }

    deleteUser(id) {
        return axios.delete(`/users/${id}`, { headers: authHeader() });
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

    getRecords(offset, rows) {
        return axios.get(`/records?offset=${offset}&limit=${rows}`, { headers: authHeader() });
    }

    createRecord(record) {
        return axios.post(`/records`, record.toJson(), { headers: authHeader() });
    }

    createRecordsFromFile(formData, category_id) {
        return axios.post(`/records_file/${category_id}`, formData, { headers: authHeader('multipart/form-data') });
    }

    precreateRecord(identifier_type, identifier_value) {
        const body = {
            identifier_type: identifier_type,
            value: identifier_value
        }
        return axios.post(`/records/precreate_by_identifier`, body, { headers: authHeader() });
    }

    updateRecord(record) {
        return axios.put(`/records/${record.id}`, record, { headers: authHeader() });
    }

    deleteRecord(id) {
        return axios.delete(`/records/${id}`, { headers: authHeader() });
    }
}

export const api = new Api();
