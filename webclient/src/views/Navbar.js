import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from "react-i18next";

import LoginDialog from '../dialogs/LoginDialog';
import UserInfo from '../components/UserInfo';
import { ActionAccessComponent } from '../services/Auth';
import './Navbar.css';
import { ActionType } from '../models/Role';

const Navbar = () => {
  const { t } = useTranslation();

  return (
    <nav className='navbar'>
      <ul className="navbar">
        <li className='navbar-button'><Link to="/">{t("home")}</Link></li>
        <ActionAccessComponent
          action={ActionType.read_datatable_own} 
          component={<li><Link to="/board">{t("board")}</Link></li>}
        />
        <ActionAccessComponent
          action={ActionType.edit_categories} 
          component={<li><Link to="/categories">{t("categories")}</Link></li>}
        />
        <ActionAccessComponent
          action={ActionType.edit_access} 
          component={<li><Link to="/access">{t("access")}</Link></li>}
        />
        <li className="right"><UserInfo /></li>
        <li className="right"><LoginDialog /></li>
      </ul>
    </nav>
  );
}

export default Navbar;
