import { Outlet } from 'react-router-dom';

import { api } from './Api';
import { User } from '../models/User';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { ActionType } from '../models/Role';

class AuthService {
    login(username, password) {
        return new Promise((resolve, reject) => {
            api.getToken(username, password)
                .then(tokenData => {
                    if (tokenData.data.access_token) {
                        this.setCurrentUser(User.fromToken(tokenData.data));
                        this.refreshUserData();
                        resolve(); 
                    } else {
                        reject();
                    }
                })
                .catch(error => {
                    console.log("Error occurred while logging in: " + error);
                    reject();
                })
            ;
            this.refreshIntervalId = setInterval(() => {
                this.refreshUserData();
            }, 60000);
        });
    }

    getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? User.fromJson(JSON.parse((user))) : null;
    }

    setCurrentUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    }

    deleteCurrentUser() {
        localStorage.removeItem("user");
    }

    logout() {
        this.deleteCurrentUser();
    }

    async register(username, password) {
        try {
            const userResponse = await api.createUser(username, password);
            return userResponse;
        } catch (error) {
            console.error("Error occurred while registering: " + error);
        }
    }

    isLoggedIn() {
        const user = this.getCurrentUser();
        return user && user.access_token && user.access_token !== "";
    }

    refreshUserData() {
        api.getCurrentUser()
            .then(userData => {
                const user = this.getCurrentUser();
                user.setUserData(userData.data);
                this.setCurrentUser(user);
            }).catch(error => {
                this.deleteCurrentUser();
            });
    }

    isAllowedTo(action) {
        return this.getCurrentUser()?.actions.includes(action);
    }

    isAllowedToEditRecord(record) {
        const user = this.getCurrentUser();
        console.log(user && (
                user.actions.includes(ActionType.edit_datatable_all)
                || (user.actions.includes(ActionType.edit_datatable_department)
                    && user.department_id === record.creator_department_id)
                || (user.actions.includes(ActionType.edit_datatable_own)
                    && user.id === record.creator_id)));
        return user && (
                user.actions.includes(ActionType.edit_datatable_all)
                || (user.actions.includes(ActionType.edit_datatable_department)
                    && user.department_id === record.creator_department_id)
                || (user.actions.includes(ActionType.edit_datatable_own)
                    && user.id === record.creator_id));
    }
}

export default function authHeader(contentType = 'application/json') {
    const user = authService.getCurrentUser();
    if (user && user.access_token) {
        return {
            Authorization: 'Bearer ' + user.access_token,
            'Content-Type': contentType,
        };
    } else {
        return {};
    }
}

export const ActionAccessRoute = ({ action = null }) => {
    const user = authService.getCurrentUser();
    return !action || (user?.actions && user.actions.includes(action))
        ? <Outlet />
        // : <Navigate to="/unauthorized" replace />;
        : null;
};

export const ActionAccessComponent = ({ action = null, component }) => {
    const user = authService.getCurrentUser();
    return (
        user?.actions && (!action ||user.actions.includes(action))
        ? (<>{component}</>)
        : null);
};

// export const ProtectedRoute = ({ ...rest }) => {
export const ProtectedRoute = () => {
    const user = authService.getCurrentUser();
    const showToast = useToast();
    const { t } = useTranslation();

    useEffect(() => {
        if (!user || !user.access_token || user.access_token === "") {
            // showToast('error', t('insufficient_rights_title'), t('insufficient_rights_body'))
        }
    }, []);

    if (!user || !user.access_token || user.access_token === "") {
        return null;
    }

    return <Outlet />;

    // return (
    //     <Route
    //     {...rest}
    //     render={(props) =>
    //         auth.isAuthenticated === true ? (
    //         <Component {...props} />
    //         ) : (
    //         <Redirect to="/login" />
    //         )
    //     }
    //     />
    // );
};

export const authService = new AuthService();
