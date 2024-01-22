import React, { ReactNode, createContext, useContext, useState } from 'react';
import { ReactKeycloakProvider } from '@react-keycloak/web';
import keycloak, { keycloakInitOptions } from '../../services/Keycloak';
import { User } from '../../types/UserModel';
import { useTranslation } from 'react-i18next';
import { useToast } from '../toast/ToastContext';
import ApiUser from '../../adapters/ApiUser';

interface UserContextProps {
    login: () => void;
    logout: () => void;
    user: User;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

interface UserProviderProps {
    children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const [user, setUser] = useState(new User());

    const setUserData = (userData) => {
        const newUser = User.createUser(userData);
        setUser(newUser);
    };

    const handleLogin = () => {
        if (keycloak && !keycloak.authenticated) {
            keycloak.login();
        }
    };

    const handleLogout = () => {
        keycloak.logout();
    };

    const getCurrentUser = async () => {
        try {
            const user = await ApiUser.getCurrentUser();
            setUserData(user.data);
        } catch (error) {
            setUser(new User());
            if (error.response && error.response.status === 401) {
                if (error.response.data?.detail !== null) {
                    showToast("error", t(error.response.data.detail), "");
                }
            } else if (error.code === 'ERR_NETWORK') {
                showToast("error", t('app_not_available'), "");
            }
        }
    }

    const handleKeycloakEvent = (eventType, error) => {
        // console.log(`eventType: ${eventType}, error: ${error}`);
        if (eventType === 'onReady') {
            if (keycloak.authenticated && keycloak.token) {
                localStorage.setItem('token', keycloak.token);
                getCurrentUser();
            } else {
                localStorage.removeItem('token');
                setUser(new User());
            }
        }

    };

    return (
        <ReactKeycloakProvider
            authClient={keycloak}
            initOptions={keycloakInitOptions}
            onEvent={handleKeycloakEvent}
        >
            <UserContext.Provider value={{ login: handleLogin, logout: handleLogout, user }}>
                {children}
            </UserContext.Provider>
        </ReactKeycloakProvider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
