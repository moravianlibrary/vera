import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// import Home from './Home'; 
import { ActionAccessRoute, authService } from '../services/Auth';
import Access from './Access';
import Navbar from './Navbar';
import '../config/i18n';
import './App.css';
import { ToastProvider } from '../services/ToastContext';
import { ActionType } from '../models/Role';
import { APP_CONFIG } from '../config/config';
import Categories from '../categories/pages/Categories';
import Documents from '../documents/pages/Documents';
import { ReactKeycloakProvider } from '@react-keycloak/web';
// import { KeycloakProvider } from "keycloak-react-web";
import keycloak from '../services/Keycloak';

// import logo from './logo.svg';

const keycloakProviderInitConfig = {
  // onLoad: 'login-required',
  onLoad: 'check-sso',
  useNonce: true,
}

function App() {
  console.log(JSON.stringify(keycloak.tokenParsed));
  return (
    <ReactKeycloakProvider
      initOptions={keycloakProviderInitConfig}
      authClient={keycloak}
    >
      <ToastProvider>
        <Router>
          <div className="App">
              <Navbar />
              <main>
                <Routes>
                  {/* <Route path="/" element={<Home />} /> */}
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
    </ReactKeycloakProvider>
  );
}

export default App;
