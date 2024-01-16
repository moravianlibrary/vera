import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { useTranslation } from 'react-i18next';
import { useToast } from '../services/ToastContext';
import UserInfo from '../components/UserInfo';
import { useUser } from '../models/UserContext';

const Login = () => {
    const { t } = useTranslation();
    const { user, login, logout } = useUser();
    const [isLoggedIn, setIsLoggedIn] = useState(false);


    useEffect(() => {
        setIsLoggedIn(user.isLoggedIn);
    }, [user.isLoggedIn]);

    return (
        <div>
            <Button
                style={{color: "white"}}
                text 
                label={isLoggedIn ? t("logout") : t("login")}
                onClick={isLoggedIn ? logout : login}
            />
        </div>
    );
};

export default Login;
