import React, { useEffect, useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import { useTranslation } from "react-i18next";

import InsertByIdentifierDialog from '../dialogs/InsertRecordDialog.js';
import { api } from '../services/Api.js';
import './Board.css';

function Funcbar({ onRefresh }) {

  return (
    <div className='funcbar'>
      <ul className="funcbar">
        <li><InsertByIdentifierDialog onRefresh={onRefresh} /></li>
      </ul>
    </div>
  );
}

const columns = [
  {
      name: 'Systémové číslo',
      selector: row => row.sysno,
      width: '150px'
  },
  {
      name: 'Ročník',
      // cell: row => <img src={row.coverimage} width={50} alt={row.name}></img>,
      selector: row => decodeURIComponent(row.volume_number) != 'null' ? decodeURIComponent(row.volume_number) : '',
      width: '100px'
  },
  {
      name: 'Číslo periodika',
      selector: row => decodeURIComponent(row.item_number) != 'null' ? decodeURIComponent(row.item_number) : '',
      width: '100px'
  },
  {
      name: 'Kategorie',
      selector: row => decodeURIComponent(row.category) != 'null' ? decodeURIComponent(row.category) : '',
      // width: '500px'
  },
  {
      name: 'Název',
      selector: row => decodeURIComponent(row.title) != 'null' ? decodeURIComponent(row.title) : '',
      // width: '100px'
  },
  {
      name: 'Počet stran',
      selector: row => row.pages_count > 0 ? row.pages_count : '',
      width: '100px'
  },
  {
      name: 'Signatura',
      selector: row => row.signature,
      width: '100px'
  },
  {
      name: 'ISSN',
      selector: row => row.issn,
      width: '100px'
  },
  {
      name: 'ISBN',
      selector: row => row.isbn,
      width: '100px'
  },
  {
      name: 'Čárový kód',
      selector: row => row.barcode,
      width: '100px'
  },
  {
      name: 'Vytvořil',
      selector: row => decodeURIComponent(row.creator),
      // width: '100px'
  },
  {
      name: 'Vytvořeno',
      selector: row => row.created_at,
      width: '200px'
  },
  {
      name: 'Extrahoval',
      selector: row => decodeURIComponent(row.extractor) != 'null' ? decodeURIComponent(row.extractor) : '',
      width: '100px'
  },
  {
      name: 'Extrahováno',
      selector: row => row.extracted_at,
      width: '200px'
  },
];

const PaginateTable = () => {
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [items, setItems] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [perPage, setPerPage] = useState(25);
  
  const { t } = useTranslation();

  const customPaginationOptions = {
    rowsPerPageText: t("rows_per_page"),
    rangeSeparatorText: t("range_separator"),
  };

  useEffect(() => {
    fetchData(1, perPage);
  }, [perPage])

  const fetchData = async (page, page_size) => {
    api.getRecords(page, page_size)
      .then(
        (result) => {
          setIsLoaded(true);
          setItems(result.records);
          setTotalRows(result.num_found);
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
      <div className="table-container">
        <DataTable
          columns={columns}
          highlightOnHover
          data={items}
          pagination
          paginationRowsPerPageOptions={[10, 25, 50]}
          paginationPerPage={25}
          paginationServer
          paginationTotalRows={totalRows}
          paginationComponentOptions={customPaginationOptions}
          onChangePage={handlePageChange}
          onChangeRowsPerPage={handlePerRowsChange}
        />
      </div>
    );
  }
}

function Board() {
  const [refreshCount, setRefreshCount] = useState(0);

  const handleRefresh = () => {
    setRefreshCount(refreshCount + 1);
  };

  return (
    <div className='Board'>
        <Funcbar onRefresh={handleRefresh} />
        <PaginateTable key={refreshCount} />
    </div>
  );
}

export default Board;
