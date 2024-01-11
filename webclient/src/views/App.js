import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// import Home from './Home'; 
import Access from './Access';
import Navbar from './Navbar';
import '../config/i18n';
import './App.css';
import { ToastProvider } from '../services/ToastContext';
import { ActionType } from '../models/Role';
import { APP_CONFIG } from '../config/config';
import Categories from '../categories/pages/Categories';
import Documents from '../documents/pages/Documents';
import Login from './Login';
import { ReactKeycloakProvider } from '@react-keycloak/web';
import keycloak from '../services/Keycloak';
import { ActionAccessRoute } from '../services/AccessService';
import { UserProvider } from '../models/UserContext';


function App() {
  return (
    <ReactKeycloakProvider
      authClient={keycloak}
    >
      <UserProvider>
      <ToastProvider>
        <Router>
          <div className="App">
              <Navbar />
              <main>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<ActionAccessRoute action={ActionType.read_datatable_own} />}>
                    <Route path="/board" element={<Documents />} />
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
      </UserProvider>
    </ReactKeycloakProvider>
  );
}

export default App;
