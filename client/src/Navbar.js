import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from "react-i18next";

import './Navbar.css'

const Navbar = () => {
  const { t } = useTranslation();

  return (
    <nav className='navbar'>
      <ul className="navbar">
        <li><Link to="/">{t("home")}</Link></li>
        <li><Link to="/board">{t("board")}</Link></li>
        <li className="right"><Link to="/login">{t("login")}</Link></li>
      </ul>
    </nav>
  );
}

export default Navbar;
