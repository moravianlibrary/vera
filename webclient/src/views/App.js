import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// import Home from './Home'; 
import { ActionAccessRoute, authService } from '../services/Auth';
import Access from './Access';
import Board from './Board';
import Navbar from './Navbar';
import '../config/i18n';
import './App.css';
import { ToastProvider } from '../services/ToastContext';
import { ActionType } from '../models/Role';
import Categories from './Categories';
import { APP_CONFIG } from '../config/config';

// import logo from './logo.svg';


function App() {
  useEffect(() => {
    authService.refreshUserData();
  }, []);

  return (
    <ToastProvider>
      <Router>
        <div className="App">
            <Navbar />
            <main>
              <Routes>
                {/* <Route path="/" element={<Home />} /> */}
                <Route element={<ActionAccessRoute action={ActionType.read_datatable_own} />}>
                  <Route path="/board" element={<Board />} />
                </Route>
                <Route element={<ActionAccessRoute action={ActionType.edit_categories} />}>
                  <Route path="/categories" element={<Categories />} />
                </Route>
                <Route element={<ActionAccessRoute action={ActionType.edit_access} />}>
                  <Route path="/access" element={<Access />} />
                </Route>
              </Routes>
            </main>
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;
