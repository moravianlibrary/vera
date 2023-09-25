import React, { useEffect, useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import { useTable, usePagination } from 'react-table';
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
    <Table columns={columns} data={data} />
  )
  // return (
  //   <table className="table" {...getTableProps()}>
  //       <thead>
  //           {headerGroups.map(headerGroup => (
  //               <tr {...headerGroup.getHeaderGroupProps()}>
  //                   {headerGroup.headers.map(column => (
  //                       <th {...column.getHeaderProps()}>{column.render('Header')}</th>
  //                   ))}
  //               </tr>
  //           ))}
  //       </thead>
  //       <tbody {...getTableBodyProps()}>
  //           {rows.map((row, i) => {
  //               prepareRow(row)
  //               return (
  //                   <tr {...row.getRowProps()}>
  //                       {row.cells.map(cell => {
  //                           return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
  //                       })}
  //                   </tr>
  //               )
  //           })}
  //       </tbody>
  //   </table>
  // )
}
const columns = [
  {
      name: 'id',
      selector: row => row.id,
      width: '100px'
  },
  {
      name: 'coverimage',
      cell: row => <img src={row.coverimage} width={50} alt={row.name}></img>,
      selector: row => row.coverimage,
      width: '100px'
  },
  {
      name: 'name',
      selector: row => row.name,
      width: '200px'
  },
  {
      name: 'detail',
      selector: row => row.detail,
      width: '500px'
  },
  {
      name: 'latitude',
      selector: row => row.latitude,
      width: '100px'
  },
  {
      name: 'longitude',
      selector: row => row.longitude,
      width: '100px'
  },
];

function Table({ columns, data }) {
  const {
      getTableProps,
      getTableBodyProps,
      headerGroups,
      prepareRow,
      page,
      canPreviousPage,
      canNextPage,
      pageOptions,
      pageCount,
      gotoPage,
      nextPage,
      previousPage,
      setPageSize,
      state: { pageIndex, pageSize },
  } = useTable(
      {
          columns,
          data,
          initialState: { pageIndex: 0, pageSize: 50 },
      },
      usePagination
  )

  return (
      <div>
          <pre>
              <code>
                  {JSON.stringify(
                      {
                          pageIndex,
                          pageSize,
                          pageCount,
                          canNextPage,
                          canPreviousPage,
                      },
                      null,
                      2
                  )}
              </code>
          </pre>
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
                  {page.map((row, i) => {
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
          {/* 
      Pagination can be built however you'd like. 
      This is just a very basic UI implementation:
    */}
          <ul className="pagination">
              <li className="page-item" onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
                  <a className="page-link">First</a>
              </li>
              <li className="page-item" onClick={() => previousPage()} disabled={!canPreviousPage}>
                  <a className="page-link">{'<'}</a>
              </li>
              <li className="page-item" onClick={() => nextPage()} disabled={!canNextPage}>
                  <a className="page-link">{'>'}</a>
              </li>
              <li className="page-item" onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
                  <a className="page-link">Last</a>
              </li>
              <li>
                  <a className="page-link">
                      Page{' '}
                      <strong>
                          {pageIndex + 1} of {pageOptions.length}
                      </strong>{' '}
                  </a>
              </li>
              <li>
                  <a className="page-link">
                      <input
                          className="form-control"
                          type="number"
                          defaultValue={pageIndex + 1}
                          onChange={e => {
                              const page = e.target.value ? Number(e.target.value) - 1 : 0
                              gotoPage(page)
                          }}
                          style={{ width: '100px', height: '20px' }}
                      />
                  </a>
              </li>{' '}
              <select
                  className="form-control"
                  value={pageSize}
                  onChange={e => {
                      setPageSize(Number(e.target.value))
                  }}
                  style={{ width: '120px', height: '38px' }}
              >
                  {[5, 10, 20, 30, 40, 50].map(pageSize => (
                      <option key={pageSize} value={pageSize}>
                          Show {pageSize}
                      </option>
                  ))}
              </select>
          </ul>
      </div >
  )
}

// function PaginatedItems({ itemsPerPage }) {
//   // Here we use item offsets; we could also use page offsets
//   // following the API or data you're working with.
//   const [itemOffset, setItemOffset] = useState(0);

//   // Simulate fetching items from another resources.
//   // (This could be items from props; or items loaded in a local state
//   // from an API endpoint with useEffect and useState)
//   const endOffset = itemOffset + itemsPerPage;
//   console.log(`Loading items from ${itemOffset} to ${endOffset}`);
//   const currentItems = items.slice(itemOffset, endOffset);
//   const pageCount = Math.ceil(items.length / itemsPerPage);

//   // Invoke when user click to request another page.
//   const handlePageClick = (event) => {
//     const newOffset = (event.selected * itemsPerPage) % items.length;
//     console.log(
//       `User requested page number ${event.selected}, which is offset ${newOffset}`
//     );
//     setItemOffset(newOffset);
//   };

//   return (
//     <>
//       <Items currentItems={currentItems} />
//       <ReactPaginate
//         breakLabel="..."
//         nextLabel="next >"
//         onPageChange={handlePageClick}
//         pageRangeDisplayed={5}
//         pageCount={pageCount}
//         previousLabel="< previous"
//         renderOnZeroPageCount={null}
//       />
//     </>
//   );
// }
function PaginateTable() {
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [items, setItems] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    fetchData(1, perPage);
  }, [perPage])

  const fetchData = async (page, per_page) => {
    // fetch(`https://www.mecallapi.com/api/attractions?page=${page}&per_page=${per_page}`)
    fetch('http://localhost:8000/records')
      .then(res => res.json())
      .then(
        (result) => {
          setIsLoaded(true);
          setItems(result.records);
          setTotalRows(result.numFound);
        },
        (error) => {
          setIsLoaded(true);
          setError(error);
        }
      )
  }

  const handlePageChange = page => {
    fetchData(page, perPage);
  }

  const handlePerRowsChange = async (newPerPage, page) => {
    setPerPage(newPerPage);
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  } else if (!isLoaded) {
    return <div>Loading...</div>;
  } else {
    return (
      <div className="App">
        <DataTable
          columns={columns}
          data={items}
          pagination
          paginationServer
          paginationTotalRows={totalRows}
          onChangePage={handlePageChange}
          onChangeRowsPerPage={handlePerRowsChange}
        />
      </div>
    );
  }
}


function Board() {
  return (
    <div>
        <Funcbar />
        <DynamicTable />
        <PaginateTable />
    </div>
  );
}

export default Board;
