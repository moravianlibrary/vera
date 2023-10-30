import { Outlet } from 'react-router-dom';

import { api } from './Api';
import { User } from '../models/User';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

class AuthService {
    login(username, password) {
        api.getToken(username, password)
            .then(tokenData => {
                if (tokenData.data.access_token) {
                    this.setCurrentUser(User.fromToken(tokenData.data));
                    this.refreshUserData();
                    console.log("User " + username + " successfully logged in.");
                }
            })
            .catch(error => {
                console.log("Error occurred while logging in: " + error);
            })
        ;
    }

    getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? User.fromJson(JSON.parse((user))) : null;
    }

    setCurrentUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    }

    logout() {
        localStorage.removeItem("user");
    }

    register(username, password) {
        return api.createUser(username, password);
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
            })
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
    console.log(user?.actions && (!action ||user.actions.includes(action)));
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
