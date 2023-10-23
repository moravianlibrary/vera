import Axios from "axios";

import authHeader from "./Auth";
import { APP_CONFIG } from "../config/config";

const axios = Axios.create({
    baseURL: `${APP_CONFIG.base_url}`,
    headers: { "Content-Type": "application/json" },
});

class Api {
    getToken(username, password) {
        return axios.post(`/auth/login`, {
            username: username,
            password: password
        })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            })
    };

    updateUser(user) {
        return axios.put(`/users/${user.id}`, user)
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            })
    }

    getUsers() {
        return axios.get(`/users`, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            }
        );
    }

    getCategories() {
        return axios.get(`/categories`, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            }
        );
    }

    getDepartments() {
        return axios.get(`/departments`, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            }
        );
    }

    getRoles() {
        return axios.get(`/roles`, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            }
        );
    }

    getRolesActions() {
        return axios.get(`/roles_actions`, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            }
        );
    }

    getRecords(offset, rows) {
        return axios.get(`/records?offset=${offset}&limit=${rows}`, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            }
        );
    }

    createRecord(record) {
        return axios.post(`/records`, record.toJson(), { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error(error);
            })
        ;
    }

    getPrecreateRecord(identifier_type, identifier_value) {
        const body = {
            identifier_type: identifier_type,
            value: identifier_value
        }
        return axios.post(`/records/precreate_by_identifier`, body, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error(error);
            })
        ;
    }

    updateRecord(record) {
        return axios.put(`/records/${record.id}`, record.toJson(), { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error(error);
            })
        ;
    }

    deleteRecord(record) {
        return axios.delete(`/records/${record.id}`, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error(error);
            })
        ;
    }
}

export const api = new Api();