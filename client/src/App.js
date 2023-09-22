import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import './App.css';
// import Home from './Home'; 
import Navbar from './Navbar';
import Board from './Board';

import logo from './logo.svg';

function App() {
  return (
    <Router>
      <div className="App">
        {/* <header className="App-header"> */}
          <Navbar />
          <main>
            <Routes>
              {/* <Route path="/" element={<Home />} /> */}
              <Route path="/board" element={<Board />} />
              {/* <Route path="/login" element={<About />} /> */}
            </Routes>
          </main>
        {/* </header> */}
      </div>
    </Router>
  );
  // return (
  //   <div className="App">
  //     <header className="App-header">
  //       <nav>
  //           <ul className="navbar">
  //               <li><a className="active" href="home">Home</a></li>
  //               <li><a href="board">Board</a></li>
  //               <li className="right"><a href="login">About</a></li>
  //           </ul>
  //       </nav>

  //       <main>
  //         <Router>
  //           <Routes>
  //             {/* <Route path="/board" element={Board} /> */}
  //             <Route path="/board" element={<Board />} />
  //             {/* <Route path="/login" component={About} /> */}
  //             {/* <Route path="/" component={Home} /> */}
  //           </Routes>
  //         </Router>
  //       </main>
  //     </header>
  //   </div>
  // );
}

export default App;
