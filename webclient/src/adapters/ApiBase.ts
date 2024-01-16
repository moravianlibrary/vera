import Axios, { AxiosInstance } from "axios";
import { APP_CONFIG } from "../config/config";

const axiosInstance: AxiosInstance = Axios.create({
    baseURL: `${APP_CONFIG.base_url}`,
    headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    },
});

export function authHeader(contentType: string = 'application/json') {
    const token = localStorage.getItem('token');
    if (token !== null) {
        return {
            Authorization: 'Bearer ' + token,
            'Content-Type': contentType,
        };
    } else {
        return {
            'Content-Type': contentType,
        };
    }
}

export default axiosInstance;
