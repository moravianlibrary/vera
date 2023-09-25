import React, { useEffect, useMemo, useState } from 'react';
import { useTable } from 'react-table';
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
  const columns = useMemo(
    () => [
      {
        Header: 'System number',
        accessor: 'sysno',
      },
      {
        Header: 'Volume number',
        accessor: 'volume_number',
      },
      {
        Header: 'Item number',
        accessor: 'item_number',
      },
      {
        Header: 'Category',
        accessor: 'category',
      },
      {
        Header: 'Title',
        accessor: 'title',
      },
      {
        Header: 'Pages count',
        accessor: 'pages_count',
      },
      {
        Header: 'Signature',
        accessor: 'signature',
      },
      {
        Header: 'ISSN',
        accessor: 'issn',
      },
      {
        Header: 'ISBN',
        accessor: 'isbn',
      },
      {
        Header: 'Barcode',
        accessor: 'barcode',
      },
      {
        Header: 'Creator',
        accessor: 'creator',
      },
      {
        Header: 'Created at',
        accessor: 'created_at',
      },
      {
        Header: 'Extractor',
        accessor: 'extractor',
      },
      {
        Header: 'Extracted at',
        accessor: 'extracted_at',
      },
    ],[]
  );

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
    fetch('http://localhost:8000/records')
      .then((response) => response.json())
      .then((data) => setData(data))
      .catch((error) => console.error('Error fetching data:', error));
  }, []);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({
    columns,
    data,
    // initialState
  },
    // useSortBy
  );

  return (
    <table className="table" {...getTableProps()}>
        <thead>
            {headerGroups.map(headerGroup => (
                <tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map(column => (
                        <th {...column.getHeaderProps()}>{column.render('Header')}</th>
                    ))}
                </tr>
            ))}
        </thead>
        <tbody {...getTableBodyProps()}>
            {rows.map((row, i) => {
                prepareRow(row)
                return (
                    <tr {...row.getRowProps()}>
                        {row.cells.map(cell => {
                            return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                        })}
                    </tr>
                )
            })}
        </tbody>
    </table>
  )
}

function Board() {
  return (
    <div>
        <Funcbar />
        <DynamicTable />
    </div>
  );
}

export default Board;
