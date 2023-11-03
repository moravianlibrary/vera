import React, { useState, useRef } from 'react';
import { useTranslation } from "react-i18next";

import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';

import { authService } from '../services/Auth';
import { Password } from 'primereact/password';
import { useToast } from '../services/ToastContext';

const RegisterDialog = () => {
    const { t } = useTranslation();
    const showToast = useToast();

    const [visible, setVisible] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [repeatPassword, setRepeatPassword] = useState('');
    const [errors, setErrors] = useState({});

    const handleRegister = () => {
        if (!username) {
            setErrors({username: true});
        } else if (password.length < 8 || password.length > 64) {
            setErrors({password_invalid_length: true});
        } else if (password !== repeatPassword) {
            setErrors({not_matching_passwords: true});
        } else {
            setErrors({});
            authService.register(username, password)
            .then(user => {
                if (user.id !== null) {
                    setVisible(false);
                    showToast('success', t('successful_registration_title'), t('successful_registration_body'));
                }
            })
            .catch(error => {
                setErrors({user_already_exists: true});
            });
        }
    };

    return (
        <div>
            <Button label={t("register_action")} text onClick={() => setVisible(true)} />
            <Dialog
                header={t('register_action')} 
                visible={visible} 
                onHide={() => setVisible(false)}
                footer={<Button label={t('register_button')} className='' onClick={handleRegister} />}
            >
                <div className="card flex flex-column gap-3 ">
                    <InputText placeholder={t('username')} keyfilter="email" value={username} onChange={(e) => setUsername(e.target.value)} />
                    {errors.username && <small className="p-error">{t('username_missing')}</small>}
                    {errors.user_already_exists && <small className="p-error">{t('user_already_exists')}</small>}
                    <Password placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} feedback={false} tabIndex={1} toggleMask />
                    {errors.password_invalid_length && <small className="p-error">{t('password_invalid_length')}</small>}
                    <Password placeholder={t('repeat_password')} value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} feedback={false} toggleMask />
                    {errors.not_matching_passwords && <small className="p-error">{t('passwords_does_not_match')}</small>}
                </div>
            </Dialog>
        </div>
    );
};

export default RegisterDialog;
