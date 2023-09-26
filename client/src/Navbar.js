import React from 'react';
import { Link } from 'react-router-dom';

import './Navbar.css'

function Navbar() {
  return (
    <nav className='navbar'>
      <ul className="navbar">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/board">Board</Link></li>
        <li className="right"><Link to="/login">About</Link></li>
      </ul>
    </nav>
  );
}

export default Navbar;
