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
        <ActionAccessComponent action={ActionType.ReadDatatable}>
          <li><Link to="/documents">{t("board")}</Link></li>
        </ActionAccessComponent>
        <ActionAccessComponent action={ActionType.ReadCategories}>
          <li><Link to="/categories">{t("categories")}</Link></li>
        </ActionAccessComponent>
        <ActionAccessComponent action={ActionType.Extract}>
          <li><Link to="/extractions">{t("Extractions")}</Link></li>
        </ActionAccessComponent>
        <ActionAccessComponent action={ActionType.PlanTasks}>
          <li><Link to="/tasks">{t("tasks")}</Link></li>
        </ActionAccessComponent>
        <ActionAccessComponent action={ActionType.EditAccess}>
          <li><Link to="/access">{t("access")}</Link></li>
        </ActionAccessComponent>
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
