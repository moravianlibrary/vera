import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { useTranslation } from 'react-i18next';
import { useUser } from '../contexts/user/UserContext';

const Login = () => {
    const { t } = useTranslation();
    const { user, login, logout } = useUser();
    const [isLoggedIn, setIsLoggedIn] = useState(false);


    useEffect(() => {
        setIsLoggedIn(user.isLoggedIn);
    }, [user.isLoggedIn]);

    return (
        <div>
            {isLoggedIn &&
            <Button
                // style={{color: "white"}}
                text 
                // label={`${user?.username} (${timeRemaining})`}
                label={user?.username}
                disabled
                // onClick={isLoggedIn ? handleLogout : handleOpen}
            />}
            <Button
                // style={{color: "white"}}
                text 
                label={isLoggedIn ? t("logout") : t("login")}
                onClick={isLoggedIn ? logout : login}
            />
        </div>
    );
};

export default Login;
