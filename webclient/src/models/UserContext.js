import React, { createContext, useContext, useEffect, useState } from 'react';
import { ReactKeycloakProvider } from '@react-keycloak/web';
import keycloak, { keycloakInitOptions } from '../services/Keycloak';
import { User } from './User';
import { useTranslation } from 'react-i18next';
import { useToast } from '../services/ToastContext';
import { api } from '../services/Api';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
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
            const user = await api.getCurrentUser();
            setUserData(user.data);
        } catch (error) {
            setUser(new User());
            if (error.response && error.response.status === 401) {
                if (error.response.data?.detail !== null) {
                    showToast("error", t(error.response.data.detail), "");
                }
            }
        }
    }

    const handleKeycloakEvent = (eventType, error) => {
        // console.log(`eventType: ${eventType}, error: ${error}`);
        if (eventType === 'onReady') {
            if (keycloak.authenticated) {
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
