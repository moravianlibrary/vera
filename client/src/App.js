import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import "./i18n";
import './App.css';
// import Home from './Home'; 
import Navbar from './Navbar';
import Board from './Board';

import logo from './logo.svg';

function App() {
  return (
    <Router>
      <div className="App">
          <Navbar />
          <main>
            <Routes>
              {/* <Route path="/" element={<Home />} /> */}
              <Route path="/board" element={<Board />} />
              {/* <Route path="/login" element={<About />} /> */}
            </Routes>
          </main>
      </div>
    </Router>
  );
}

export default App;
