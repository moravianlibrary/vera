import React, { useEffect, useState } from 'react';

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Paginator } from 'primereact/paginator';
import { Button } from 'primereact/button';
import { Ripple } from 'primereact/ripple';
import { Divider } from 'primereact/divider';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Slider } from 'primereact/slider';
import { Tooltip } from 'primereact/tooltip';
import { classNames } from 'primereact/utils';

import { useTranslation } from "react-i18next";
import i18n from 'i18next';

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
      name: i18n.t('sysno'),
      selector: record => record.sysno,
      width: '120px'
  },
  {
      name: i18n.t('volume_number'),
      selector: record => record.volume_number,
  },
  {
      name: i18n.t('item_number'),
      selector: record => record.item_number,
  },
  {
      name: i18n.t('category'),
      selector: record => record.category_name,
  },
  {
      name: i18n.t('title'),
      selector: record => record.title,
  },
  {
      name: i18n.t('pages_count'),
      selector: record => record.pages_count,
  },
  {
      name: i18n.t('signature'),
      selector: record => record.signature,
  },
  {
      name: i18n.t('issn'),
      selector: record => record.issn,
  },
  {
      name: i18n.t('isbn'),
      selector: record => record.isbn,
  },
  {
      name: i18n.t('barcode'),
      selector: record => record.barcode,
  },
  {
      name: i18n.t('creator'),
      selector: record => record.creator,
  },
  {
      name: i18n.t('created_at'),
      selector: record => record.getCreatedAtFormatted(),
  },
  {
      name: i18n.t('extractor'),
      selector: record => record.extractor,
  },
  {
      name: i18n.t('extracted_at'),
      selector: record => record.getExtractedAtFormatted(),
  },
];

const PaginateTable = () => {
  const template1 = {
      layout: 'PrevPageLink PageLinks NextPageLink RowsPerPageDropdown CurrentPageReport',
      PrevPageLink: (options) => {
          return (
            <div>
                vpravo
              <button onClick={options.onClick} >
              {/* <button type="button" className={classNames(options.className, 'border-round')} onClick={options.onClick} disabled={options.disabled}> */}
                <i className="pi pi-check"></i>
                  <span className="p-3">Previous</span>
                  <Ripple />
              </button>

            </div>
          );
      },
      NextPageLink: (options) => {
          return (
              <button type="button" className={classNames(options.className, 'border-round')} onClick={options.onClick} disabled={options.disabled}>
                  <span className="p-3">Next</span>
                  <Ripple />
              </button>
          );
      },
      PageLinks: (options) => {
          if ((options.view.startPage === options.page && options.view.startPage !== 0) || (options.view.endPage === options.page && options.page + 1 !== options.totalPages)) {
              const className = classNames(options.className, { 'p-disabled': true });

              return (
                  <span className={className} style={{ userSelect: 'none' }}>
                      ...
                  </span>
              );
          }

          return (
              <button type="button" className={options.className} onClick={options.onClick}>
                  {options.page + 1}
                  <Ripple />
              </button>
          );
      },
      RowsPerPageDropdown: (options) => {
          const dropdownOptions = [
              { label: 10, value: 10 },
              { label: 20, value: 20 },
              { label: 30, value: 30 },
          ];
          return (<div>
            nadpis
            <Dropdown value={options.value} options={dropdownOptions} onChange={options.onChange} />
          </div>
          );
      },
      CurrentPageReport: (options) => {
          return (
              <span className="mx-3" style={{ color: 'var(--text-color)', userSelect: 'none' }}>
                  Go to
                  {/* <InputText size="2" className="ml-1" value={currentPage} tooltip={pageInputTooltip} onKeyDown={(e) => onPageInputKeyDown(e, options)} onChange={onPageInputChange} /> */}
              </span>
          );
      }
  };

  const tableStyles = {
    minWidth: '80%',
  };

  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [records, setRecords] = useState([]);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { t } = useTranslation();

  const customPaginationOptions = {
    rowsPerPageText: t("rows_per_page"),
    rangeSeparatorText: t("range_separator"),
  };

  useEffect(() => {
    fetchData(0, rows);
  }, [rows])

  const fetchData = async (offset, rows) => {
    api.getRecords(offset, rows)
      .then(
        (result) => {
          setIsLoaded(true);
          setRecords(result.records.map(record => Record.fromJson(record)));
          setTotalRows(result.num_found);
        },
        (error) => {
          setIsLoaded(true);
          setError(error);
        }
      )
  }

  const leftContent = <Button type="button" icon="pi pi-star" className="p-button-outlined" />;
  
  const handlePageChange = (event) => {
    setOffset(event.first);
    setRows(event.rows);
    fetchData(offset, rows);
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
      const itemIndex = records.findIndex((item) => item.id === updatedRecord.id);
      records[itemIndex] = record;
      handleCloseEditDialog();
      handlePageRefresh();
    })
    .catch((error) => {
      console.error('Error updating record:', error);
    });
  }

  const handleDeleteRecord = (record) => {
    api.deleteRecord(record).then((deletedRecord) => {
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
      <div className="table-container" style={tableStyles}>

        <DataTable value={records}
            tableStyle={{ minWidth: '50rem' }} 
            leftContent={leftContent}
            // paginator
            // paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            // first={offset}
            // rows={rows}
            // totalRecords={totalRows}
            // onPageChange={handlePageChange}
        >
          <Column field="sysno" header="Code"></Column>
          <Column field="volume_number" header="Name"></Column>
          <Column field="item_number" header="Category"></Column>
          <Column field="quantity" header="Quantity"></Column>
        </DataTable>

        {/* <Divider /> */}

        <Paginator first={offset} rows={rows} totalRecords={totalRows} onPageChange={handlePageChange}
          // template="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
          template={template1}
        />

    
        {/* <DataTable
          columns={columns}
          data={records}
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
          selectableRows
        /> */}

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
