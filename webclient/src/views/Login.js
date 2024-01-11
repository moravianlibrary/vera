import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { useTranslation } from 'react-i18next';
import { useToast } from '../services/ToastContext';
import { authService } from '../services/Auth';
import UserInfo from '../components/UserInfo';
import { accessService } from '../services/AccessService';
import { useKeycloak } from '../services/Keycloak';
import { useLocation } from 'react-router-dom';

const Login = () => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { keycloak } = useKeycloak();

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

    // useEffect(() => {
    //     const exchangeCodeForToken = async () => {
    //         const params = new URLSearchParams(location.search);
    //         const code = params.get('code');
    //         if (code !== null && await keycloak.exchangeCodeForToken(code)) {
    //         }
    //     };
    //     if (!keycloak.isLoggedIn) {
    //         exchangeCodeForToken();
    //     }
    //     console.log(keycloak);
    // }, [location]);

    useEffect(() => {
        setIsLoggedIn(keycloak.isLoggedIn);
    }, [keycloak.isLoggedIn]);

    return (
        <div>
            {isLoggedIn && <UserInfo />}
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
