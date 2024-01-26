import React, { StrictMode } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// import Home from './Home'; 
import Access from './Access';
import Navbar from '../components/Navbar';
import '../config/i18n';
import '../styles/App.css';
import { ToastProvider } from '../contexts/toast/ToastContext';
import Categories from '../pages/Categories';
import Documents from '../pages/Documents';
import Login from '../components/Login';
import { ActionAccessRoute } from '../services/AccessService';
import { UserProvider } from '../contexts/user/UserContext';
import { DataProvider } from '../services/Data';
import Tasks from './Tasks';
import { ActionType } from '../types/ActionType';


function App() {
  return (
    <ToastProvider>
      <UserProvider>
        <DataProvider>
          <StrictMode>
            <Router>
              <div className="App">
                  <Navbar />
                  <main>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route element={<ActionAccessRoute action={ActionType.ReadDatatableOwn} />}>
                        <Route path="/board" element={<Documents />} />
                      </Route>
                      <Route element={<ActionAccessRoute action={ActionType.EditCategories} />}>
                        <Route path="/categories" element={<Categories />} />
                      </Route>
                      <Route element={<ActionAccessRoute action={ActionType.EditCategories} />}>
                        <Route path="/tasks" element={<Tasks />} />
                      </Route>
                      <Route element={<ActionAccessRoute action={ActionType.EditAccess} />}>
                        <Route path="/access" element={<Access />} />
                      </Route>
                    </Routes>
                  </main>
              </div>
            </Router>
          </StrictMode>
        </DataProvider>
      </UserProvider>
    </ToastProvider>
  );
}

export default App;
