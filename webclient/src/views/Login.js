import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { useTranslation } from 'react-i18next';
import { useToast } from '../services/ToastContext';
import { authService } from '../services/Auth';
import keycloak from '../services/Keycloak';
import { useKeycloak } from '@react-keycloak/web';

const Login = () => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { keycloak, initialized } = useKeycloak();

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
            if (keycloak.token !== null && !keycloak.isTokenExpired()) {
                setIsLoggedIn(true);
            } else {
                setIsLoggedIn(false);
            }
        } else {
            setIsLoggedIn(false);
        }
    }, [keycloak.token]);

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
