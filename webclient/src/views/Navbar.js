import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from "react-i18next";

import LoginDialog from '../dialogs/LoginDialog';
import { ProtectedRoute } from '../services/Auth';
import './Navbar.css';

const Navbar = () => {
  const { t } = useTranslation();

  return (
    <nav className='navbar'>
      <ul className="navbar">
        <li className='navbar-button'><Link to="/">{t("home")}</Link></li>
        <li><Link to="/board">{t("board")}</Link></li>
        <li><Link to="/access">{t("access")}</Link></li>
        {/* <li className="right"><Link to="/login">{t("login")}</Link></li> */}
        <li className="right"><LoginDialog /></li>
      </ul>
    </nav>
  );
}

export default Navbar;
