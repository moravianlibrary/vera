import React, { useEffect, useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import { useTranslation } from "react-i18next";

import InsertByIdentifierDialog from '../dialogs/InsertRecordDialog.js';
import { api } from '../services/Api.js';
import { Record } from '../models/Record.js';
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
      selector: record => record.sysno,
      width: '150px'
  },
  {
      name: 'Ročník',
      // cell: row => <img src={row.coverimage} width={50} alt={row.name}></img>,
      selector: record => record.volumeNumber,
      width: '100px'
  },
  {
      name: 'Číslo periodika',
      selector: record => record.itemNumber,
      width: '100px'
  },
  {
      name: 'Kategorie',
      selector: record => record.category,
      // width: '500px'
  },
  {
      name: 'Název',
      selector: record => record.title,
      // width: '100px'
  },
  {
      name: 'Počet stran',
      selector: record => record.pagesCount,
      width: '100px'
  },
  {
      name: 'ISSN',
      selector: record => record.issn,
      width: '100px'
  },
  {
      name: 'ISBN',
      selector: record => record.isbn,
      width: '100px'
  },
  {
      name: 'Čárový kód',
      selector: record => record.barcode,
      width: '100px'
  },
  {
      name: 'Vytvořil',
      selector: record => record.creator,
      // width: '100px'
  },
  {
      name: 'Vytvořeno',
      selector: record => record.getCreatedAtFormatted(),
      width: '200px'
  },
  {
      name: 'Extrahoval',
      selector: record => record.extractor,
      width: '100px'
  },
  {
      name: 'Extrahováno',
      selector: record => record.getExtractedAtFormatted(),
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
          setItems(result.records.map(record => Record.fromJson(record)));
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

  const handleRowClicked = (row) => {
    // setSelectedRow(row);
    // Open your dialog or perform any action here
    console.log('Row clicked:', row);
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
          data={items}
          onRowClicked={handleRowClicked}
          highlightOnHover
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
