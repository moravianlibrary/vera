import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { useTranslation } from 'react-i18next';
import { useToast } from '../services/ToastContext';
import UserInfo from '../components/UserInfo';
import { useKeycloak } from '@react-keycloak/web';
import { accessService } from '../services/AccessService';
import { useUser } from '../models/UserContext';
import { api } from '../services/Api';
import { User } from '../models/User';

const Login = () => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { keycloak, initialized } = useKeycloak();
    const { setUser } = useUser();

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const handleLogin = () => {
        if (initialized && !keycloak.authenticated) {
            keycloak.login();
        }
    };

    const handleLogout = () => {
        keycloak.logout();
    };

    const getCurrentUser = async () => {
        if (!initialized || keycloak.isTokenExpired()) {
            return;
        }

        try {
            const user = await api.getCurrentUser();
            console.log(User.fromJson(user.data));
            setUser(User.fromJson(user.data));
        } catch (error) {
            if (error.response && error.response.status === 401) {
                if (error.response.data?.detail !== null) {
                    showToast("error", t(error.response.data.detail), "");
                }
            }
        }
    };

    useEffect(() => {
        if (initialized) {
            localStorage.setItem('token', keycloak.token);
            const isLoggedIn = initialized && keycloak.token !== null && !keycloak.isTokenExpired();
            if (isLoggedIn) {
                getCurrentUser();
                setIsLoggedIn(isLoggedIn);
            }
        }
    }, [keycloak.token]);

    useEffect(() => {
        // getCurrentUser();
    }, []);

    return (
        <div>
            <Button
                style={{color: "white"}}
                text 
                label={isLoggedIn ? t("logout") : t("login")}
                onClick={isLoggedIn ? handleLogout : handleLogin}
            />
        </div>
    );
};

export default Login;
