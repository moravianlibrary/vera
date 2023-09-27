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

    getRecords(page, page_size) {
        return axios.get(`/records?page=${page}&page_size=${page_size}`, { headers: authHeader() })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.log(axios.getUri());
                console.log(APP_CONFIG.base_url);
                throw error;
            }
        );
    }
}

export const api = new Api();