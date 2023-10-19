import React, { useEffect, useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import { useTranslation } from "react-i18next";

import InsertRecordDialog from '../dialogs/InsertRecordDialog.js';
import EditRecordDialog from '../dialogs/EditRecordDialog.js';
import { api } from '../services/Api.js';
import { Record } from '../models/Record.js';
import './Board.css';

function Funcbar({ onRefresh }) {

  return (
    <div className='funcbar'>
      <ul className="funcbar">
        <li><InsertRecordDialog onRefresh={onRefresh} /></li>
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
      selector: record => record.item_number,
      width: '100px'
  },
  {
      name: 'Kategorie',
      selector: record => record.category_name,
      // width: '500px'
  },
  {
      name: 'Název',
      selector: record => record.title,
      // width: '100px'
  },
  {
      name: 'Počet stran',
      selector: record => record.pages_count,
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
  const [refreshCount, setRefreshCount] = useState(0);

  const [items, setItems] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { t } = useTranslation();

  const customPaginationOptions = {
    rowsPerPageText: t("rows_per_page"),
    rangeSeparatorText: t("range_separator"),
  };

  useEffect(() => {
    fetchData(1, perPage);
  }, [perPage])

  const fetchData = async (page, page_size) => {
    console.log(page);
    setPage(page);
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

  const handlePageRefresh = () => {
    setRefreshCount(refreshCount + 1);
  };

  const handleRecordEdit = (record) => {
    setSelectedRecord(record);
    setIsDialogOpen(true);
  }

  const handleCloseEditDialog = () => {
    setSelectedRecord(null);
    setIsDialogOpen(false);
  };

  const handleUpdateRecord = (record) => {
    api.updateRecord(record).then((updatedRecord) => {
      const itemIndex = items.findIndex((item) => item.id === updatedRecord.id);
      items[itemIndex] = record;
      handleCloseEditDialog();
      handlePageRefresh();
    })
    .catch((error) => {
      console.error('Error updating record:', error);
    });
  }

  const handleDeleteRecord = (record) => {
    api.deleteRecord(record).then((deletedRecord) => {
      fetchData(page, perPage);
      handleCloseEditDialog();
      handlePageRefresh();
    })
    .catch((error) => {
      console.error('Error deleting record:', error);
    });
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
          onRowDoubleClicked={handleRecordEdit}
          pointerOnHover
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

        {isDialogOpen && (
          <EditRecordDialog
            selectedRecord={selectedRecord}
            onClose={handleCloseEditDialog}
            onUpdateRecord={handleUpdateRecord}
            onDeleteRecord={handleDeleteRecord}
          />
        )}
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
