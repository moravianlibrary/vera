import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from "react-i18next";

// import UserInfo from '../components/UserInfo';
import '../styles/Navbar.css';
import Login from './Login';
import { ActionAccessComponent } from '../services/AccessService';
import { ActionType } from '../types/ActionType';

const Navbar = () => {
  const { t } = useTranslation();

  return (
    <nav className='navbar'>
      <ul className="navbar">
        <li className='navbar-button'><Link to="/">{t("home")}</Link></li>
        <ActionAccessComponent
          action={ActionType.ReadDatatableOwn} 
          component={<li><Link to="/board">{t("board")}</Link></li>}
        />
        <ActionAccessComponent
          action={ActionType.EditCategories} 
          component={<li><Link to="/categories">{t("categories")}</Link></li>}
        />
        <ActionAccessComponent
          action={ActionType.EditCategories} 
          component={<li><Link to="/tasks">{t("tasks")}</Link></li>}
        />
        <ActionAccessComponent
          action={ActionType.EditAccess} 
          component={<li><Link to="/access">{t("access")}</Link></li>}
        />
        <li className="right"><Login /></li>
        {/* <ActionAccessComponent
          action={null}
          component={<li className="right"><UserInfo /></li>}
        /> */}
      </ul>
    </nav>
  );
}

export default Navbar;
