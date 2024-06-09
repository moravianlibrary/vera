import React, { ReactNode, createContext, useContext, useState } from "react";
import { ReactKeycloakProvider } from "@react-keycloak/web";
import keycloak, { keycloakInitOptions } from "../../services/Keycloak";
import { UserModel } from "./UserModel";
import { useTranslation } from "react-i18next";
import { useToast } from "../toast/ToastContext";
import ApiUser, { User } from "../../adapters/ApiUser";

interface UserContextProps {
    login: () => void;
    logout: () => void;
    setUserData: (data: User) => void;
    user: UserModel;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

interface UserProviderProps {
    children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const [user, setUser] = useState(new UserModel());

    const setUserData = (userData: User) => {
        const newUser = UserModel.createUser(userData);
        setUser(newUser);
    };

    const handleLogin = () => {
        if (keycloak && !keycloak.authenticated) {
            keycloak.login();
        }
    };

    const handleLogout = () => {
        if (keycloak && keycloak.authenticated) {
            keycloak.logout();
        }
    };

    const getCurrentUser = async () => {
        try {
            const user = await ApiUser.getCurrentUser();
            setUserData(user.data);
        } catch (error) {
            console.error(error);
            setUser(new UserModel());
            if (error.response && error.response.status === 401) {
                if (error.response.data?.detail !== null) {
                    showToast("error", t(error.response.data.detail), "");
                }
            } else if (error.code === "ERR_NETWORK") {
                showToast("error", t("app_not_available"), "");
            }
            const newUser = UserModel.createEmptyUser();
            setUser(newUser);
        }
    };

    const handleKeycloakEvent = (eventType, error) => {
        if (eventType === "onReady" || eventType === "onAuthRefreshSuccess") {
            if (keycloak.authenticated && keycloak.token) {
                localStorage.setItem("token", keycloak.token);
                getCurrentUser();
            } else {
                localStorage.removeItem("token");
                setUser(new UserModel());
            }
        }
    };

    return (
        <ReactKeycloakProvider
            authClient={keycloak}
            initOptions={keycloakInitOptions}
            onEvent={handleKeycloakEvent}
        >
            <UserContext.Provider
                value={{
                    login: handleLogin,
                    logout: handleLogout,
                    setUserData,
                    user,
                }}
            >
                {children}
            </UserContext.Provider>
        </ReactKeycloakProvider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};
