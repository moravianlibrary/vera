import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { useTranslation } from 'react-i18next';
import { useToast } from '../services/ToastContext';
import UserInfo from '../components/UserInfo';
import { useKeycloak } from '@react-keycloak/web';
import { accessService } from '../services/AccessService';
import { useUser } from '../models/UserContext';

const Login = () => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { keycloak, initialized } = useKeycloak();
    const { setUser } = useUser();

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const handleLogin = () => {
        if (!isLoggedIn) {
            keycloak.login();
        }
    };

    const handleLogout = () => {
        if (isLoggedIn) {
            keycloak.logout();
        }
    };

    useEffect(() => {
        if (initialized) {
            localStorage.setItem('token', keycloak.token);
            setIsLoggedIn(initialized && keycloak.token !== null && !keycloak.isTokenExpired());
        }
    }, [keycloak.token]);

    useEffect(() => {
        const getCurrentUser = async () => {
            const user = await accessService.getCurrentUser();
            if (user !== null) {
                setUser(user);
            }
        };
        getCurrentUser();
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
