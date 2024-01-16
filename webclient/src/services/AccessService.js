import { Outlet } from "react-router-dom";
import { User } from "../contexts/user/UserModel";
import { api } from "./Api";
import { ActionType } from "../contexts/user/RoleModel";
import { useToast } from "./ToastContext";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useUser } from "../contexts/user/UserContext";
import { useKeycloak } from "@react-keycloak/web";

class AccessService {
    async getCurrentUser() {
        try {
            return (await api.getCurrentUser()).data;
        } catch (error) {
            console.error('Error loading current user:', error.message);
        }
        return null;
    }
    
    isAllowedTo(user, action) {
        return user?.actions.includes(action);
    }

    isAllowedToEditDocument(user, document) {
        return user && user.actions && (
                user.actions.includes(ActionType.edit_datatable_all)
                || (user.actions.includes(ActionType.edit_datatable_department)
                    && user.department_id === document.creator_department_id)
                || (user.actions.includes(ActionType.edit_datatable_own)
                    && user.id === document.creator_id));
    }
};

export const ActionAccessRoute = ({ action = null }) => {
    const { user } = useUser();

    return !action || (user?.actions && user.actions.includes(action))
        ? <Outlet />
        // : <Navigate to="/unauthorized" replace />;
        : null;
};

export const ActionAccessComponent = ({ action = null, component }) => {
    const { user } = useUser();

    return (
        user?.actions && (!action ||user.actions.includes(action))
        ? (<>{component}</>)
        : null);
};

// export const ProtectedRoute = ({ ...rest }) => {
export const ProtectedRoute = () => {
    const { user } = useUser();
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

export default function authHeader(contentType = 'application/json') {
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

export const accessService = new AccessService();
