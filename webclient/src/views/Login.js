import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { useTranslation } from 'react-i18next';
import { useToast } from '../services/ToastContext';
import { authService } from '../services/Auth';
import keycloak from '../services/Keycloak';

const Login = () => {
    const { t } = useTranslation();
    const showToast = useToast();

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    // const [isLoggedIn, setIsLoggedIn] = useState(authService.getCurrentUser);
    const [errors, setErrors] = useState({});

    const handleLogin = () => {
        // const loginUrl = keycloak.createLoginUrl();
        // authService.login()
        // .then(() => {
        //     setIsLoggedIn(true);
        //     showToast('success', t('successful_login_title'), t('successful_login_body'));
        //     setTimeout(() => {
        //         window.location.reload();
        //     }, 500);
        // })
        // .catch(() => {
        //     setErrors({combination: true});
        // });
        keycloak.init({ onLoad: 'login-required' })
        .then((authenticated) => {
            if (authenticated) {
            console.log('User is authenticated');
            // Additional logic upon successful authentication
            } else {
            console.error('Authentication failed');
            }
        })
        .catch((error) => {
            console.error('Initialization error', error);
        });
    };

    const handleLogout = () => {
        authService.logout();
        setIsLoggedIn(false);
        window.location.reload();
    };

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
