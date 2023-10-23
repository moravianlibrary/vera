import React, { useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// import Home from './Home'; 
import { ProtectedRoute } from '../services/Auth';
import Access from './Access';
import Board from './Board';
import Navbar from './Navbar';
import '../config/i18n';
import './App.css';
import { Messages } from 'primereact/messages';

// import logo from './logo.svg';


function App() {
  const msgs = useRef(null);

  return (
    <Router>
      <div className="App">
          <Navbar />
          <main>
            <Routes>
              {/* <Route path="/" element={<Home />} /> */}
              <Route path="/board" element={<ProtectedRoute />}>
                <Route path="/board" element={<Board />} />
              </Route>
              <Route path="/access" element={<ProtectedRoute />}>
                <Route path="/access" element={<Access />} />
              </Route>
            </Routes>
            <Messages ref={msgs} />
          </main>
      </div>
    </Router>
  );
}

export default App;
