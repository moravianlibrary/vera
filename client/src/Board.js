import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import './Board.css'

function Funcbar() {
    return (
      <ul className="funcbar">
        <li><button type="button">Insert</button></li>
        {/* <li><button onClick={() => navigateTo('/')} type="button">Home</button></li> */}
      </ul>
    );
}

function DynamicTable() {
  const [data, setData] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([
    'sysno',
    'category',
    'title',
    'pages_count',
    'creator',
    'created_at',
  ]);

  useEffect(() => {
    // Fetch data from your API here and set it to the `data` state
    // Replace this with your actual API endpoint
    fetch('http://localhost:8000/records')
      .then((response) => response.json())
      .then((data) => setData(data))
      .catch((error) => console.error('Error fetching data:', error));
  }, []);

  // Define all possible columns
  const allColumns = [
    'sysno',
    'volume_number',
    'item_number',
    'category',
    'title',
    'pages_count',
    'signature',
    'issn',
    'isbn',
    'barcode',
    'creator',
    'created_at',
    'extractor',
  ];

  return (
    <table>
      <thead>
        <tr>
          {visibleColumns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {visibleColumns.map((column) => (
              <td key={column}>{row[column]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Board() {
  return (
    <div id='board'>
        <Funcbar />
        <DynamicTable />
    </div>
  );
}

export default Board;
