import { Outlet } from "react-router-dom";
import { User } from "../models/User";
import { api } from "./Api";

class AccessService {
    async loadCurrentUser() {
        try {
            this.deleteCurrentUser();
            const user = (await api.getCurrentUser()).data;
            localStorage.setItem('user', JSON.stringify(user));
        } catch (error) {
            console.error('Error loading current user:', error.message);
        }
    }

    getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? User.fromJson(JSON.parse((user))) : null;
    }

    deleteCurrentUser() {
        localStorage.removeItem("user");
    }
};

export const ActionAccessRoute = ({ action = null }) => {
    const user = accessService.getCurrentUser();
    return !action || (user?.actions && user.actions.includes(action))
        ? <Outlet />
        // : <Navigate to="/unauthorized" replace />;
        : null;
};

export const ActionAccessComponent = ({ action = null, component }) => {
    const user = accessService.getCurrentUser();
    return (
        user?.actions && (!action ||user.actions.includes(action))
        ? (<>{component}</>)
        : null);
};

export default function authHeader(contentType = 'application/json') {
    const token = localStorage.getItem('token');
    if (token !== null) {
        return {
            Authorization: 'Bearer ' + token,
            'Content-Type': contentType,
        };
    } else {
        return {};
    }
}

export const accessService = new AccessService();
