import React, { useState, useRef } from 'react';
import { useTranslation } from "react-i18next";

import { authService } from '../services/Auth';
import RegisterDialog from './RegisterDialog';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Card } from 'primereact/card';
import { Password } from 'primereact/password';

const LoginDialog = () => {
    const { t } = useTranslation();

    const [isLoggedIn, setIsLoggedIn] = useState(authService.getCurrentUser);
    const [visible, setVisible] = useState(false);
    const [username, setUsername] = useState(null);
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({});

    const handleOpen = () => {
        setVisible(true);
    };

    const handleClose = () => {
        setVisible(false);
    };

    const handleLogin = () => {
        if (!username) {
            setErrors({username: true});
        } else {
            setErrors({});
            authService.login(username, password);
            setIsLoggedIn(true);
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
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
                onClick={isLoggedIn ? handleLogout : handleOpen}
            />
            <Dialog
                header={t('login')} 
                visible={visible} 
                onHide={handleClose}
            >
                <Card 
                    style={{marginBottom: '5px'}}
                    footer={<Button label={t('login_button')} onClick={handleLogin} />}
                >
                    <div className="card flex flex-column align-items-center gap-3 ">
                        <InputText id='username' placeholder={t('username')} keyfilter="email" value={username} onChange={(e) => setUsername(e.target.value)} />
                        {errors.username && <small className="p-error">{t('username_missing')}</small>}
                        <Password placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} feedback={false} tabIndex={1} toggleMask />
                    </div>
                </Card>
                <RegisterDialog />
            </Dialog>
        </div>
    );
};

export default LoginDialog;
