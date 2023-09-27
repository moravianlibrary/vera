import React, { useState, useRef } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import { useTranslation } from "react-i18next";

import { authService } from '../services/Auth';

const LoginDialog = () => {
  const insertDialogButtonStyle = {
    textTransform: 'none',
    display: 'block',
    color: 'white',
    'text-align': 'center',
    padding: '14px 16px',
    'text-decoration': 'none'
  };

  const insertApplyButtonStyle = {
    borderRadius: '8px',
    padding: '10px 20px',
    textTransform: 'none',
  }

  const { t } = useTranslation();

  const [isLoggedIn, setIsLoggedIn] = useState(authService.getCurrentUser);
  const [isOpen, setState] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleClickOpen = () => {
    setState(true);
  };

  const handleClose = () => {
    setState(false);
  };
  const handleLogin = () => {
    authService.login(username, password);
    setIsLoggedIn(true);
    handleClose();
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleLogout = () => {
    authService.logout();
    setIsLoggedIn(false);
    window.location.reload();
  };

  return (
    <div>
      {!isLoggedIn ? (
        <Button variant="text" onClick={handleClickOpen} style={insertDialogButtonStyle}>
          {t("login")}
        </Button>
      ) : (
        <Button variant="text" onClick={handleLogout} style={insertDialogButtonStyle}>
          {t("logout")}
        </Button>
      )}
      <Dialog open={isOpen} onClose={handleClose}>
        <DialogTitle>{t("login")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("login_tooltip")}
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="username"
            label={t("username")}
            type="text"
            fullWidth
            variant="standard"
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            margin="dense"
            id="password"
            label={t("password")}
            type="password"
            fullWidth
            variant="standard"
            onChange={(e) => setPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' onClick={handleLogin} style={insertApplyButtonStyle}>{t("login_button")}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default LoginDialog;
