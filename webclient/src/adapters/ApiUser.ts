import axiosInstance, { authHeader } from "./ApiBase";

interface User {
    
}

namespace ApiUser {
    export function getCurrentUser() {
        return axiosInstance.get(`/auth/current_user`, { headers: authHeader() });
    }
}

export default ApiUser;
