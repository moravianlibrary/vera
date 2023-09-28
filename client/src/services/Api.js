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
                throw error;
            }
        );
    }

    createRecord(sysno, volume_number, item_number, category, title,
            pages_count, signature, issn, isbn, barcode) {
        const parsedInt = parseInt(pages_count, 10);
  
        const body = {
            sysno: sysno,
            volume_number: volume_number,
            item_number: item_number,
            category: category,
            title: title,
            pages_count: isNaN(parsedInt) ? null : parsedInt,
            signature: signature,
            issn: issn,
            isbn: isbn,
            barcode: barcode
        }
        console.log(body);
        return axios.post(`/records`, body, { headers: authHeader() })
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
}

export const api = new Api();