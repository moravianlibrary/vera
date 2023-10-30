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
    }

    createUser(username, password) {
        return axios.post(`/auth/register`, {
            username: username,
            password: password
        })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            })
    }

    getCurrentUser() {
        return axios.get(`/auth/current_user`, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            }
        );
    }

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

    createDepartment(department) {
        return axios.post(`/departments`, department, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error(error);
            }
        );
    }

    updateDepartment(department) {
        return axios.put(`/departments/${department.id}`, department, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error(error);
            }
        );
    }

    getRoleNames() {
        return axios.get(`/roles_names`, { headers: authHeader() })
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

    createRole(role) {
        return axios.post(`/roles`, role.toJson(), { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error(error);
            }
        );
    }

    updateRole(role) {
        return axios.put(`/roles/${role.id}`, role.toJson(), { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error(error);
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

    createRecordsFromFile(formData, category_id) {
        return axios.post(`/records_file/${category_id}`, formData, { headers: authHeader('multipart/form-data') })
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
        // return axios.put(`/records/${record.id}`, record.toJson(), { headers: authHeader() })
        return axios.put(`/records/${record.id}`, record, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error(error);
            })
        ;
    }

    deleteRecord(id) {
        return axios.delete(`/records/${id}`, { headers: authHeader() })
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
