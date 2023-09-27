import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// import Home from './Home'; 
import { ProtectedRoute } from '../services/Auth';
import Navbar from './Navbar';
import Board from './Board';
import '../config/i18n';
import './App.css';

// import logo from './logo.svg';

function App() {
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
            </Routes>
          </main>
      </div>
    </Router>
  );
}

export default App;
