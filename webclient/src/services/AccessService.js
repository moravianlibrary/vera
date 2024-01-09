class AccessService {
    loadCurrentUser() {
    }

    getCurrentUser() {
    }

    deleteCurrentUser() {

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

export const accessService = new AccessService();
