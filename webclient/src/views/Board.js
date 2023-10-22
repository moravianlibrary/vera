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
import { DomHandler, classNames } from 'primereact/utils';

import { useTranslation } from "react-i18next";
import i18n from 'i18next';

import InsertRecordDialog from '../dialogs/InsertRecordDialog.js';
import EditRecordDialog from '../dialogs/EditRecordDialog.js';
import { api } from '../services/Api.js';
import { Record } from '../models/Record.js';
import './Board.css';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Tag } from 'primereact/tag';
import { useRef } from 'react';
import { da } from 'date-fns/locale';

function Funcbar({ onRefresh }) {

  return (
    <div className='funcbar'>
      <ul className="funcbar">
        <li><InsertRecordDialog onRefresh={onRefresh} /></li>
      </ul>
    </div>
  );
}

const PaginateTable = () => {
  const tableStyles = {
    minWidth: '80%',
  };

    const [editingRows, setEditingRows] = useState([]);


  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState(15);
  const [totalRows, setTotalRows] = useState(0);

    const [categories, setCategories] = useState([]);
  const [newRecord, setNewRecord] = useState({});
  const [records, setRecords] = useState([]);

  const [selectedRecord, setSelectedRecord] = useState(new Record());
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [insertMode, setInsertMode] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { t } = useTranslation();

  const customPaginationOptions = {
    rowsPerPageText: t("rows_per_page"),
    rangeSeparatorText: t("range_separator"),
  };

  useEffect(() => {
    fetchData(0, rows);
  }, [rows]);

    useEffect(() => {
        fetchCategories()
    }, []);

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

    const fetchCategories = () => {
        api.getCategories().then(
            (result) => {
                setCategories(result.map(category => category.name));
            },
            (error) => {

            }
        )
    }

  const leftContent = <Button type="button" icon="pi pi-star" className="p-button-outlined" />;
  
  const handlePageChange = (event) => {
    setOffset(event.first);
    setRows(event.rows);
    fetchData(offset, rows);
    console.log("page refresh");
  }

  const handlePageRefresh = () => {
    setRefreshCount(refreshCount + 1);
  };

  const handleRecordEdit = (record) => {
    setSelectedRecords([record]);
    setIsDialogOpen(true);
  }

  const handleCloseEditDialog = () => {
    setSelectedRecords([]);
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

    const textEditor = (options) => {
        return <InputText type="text" value={options.value} onChange={(e) => options.editorCallback(e.target.value)} />;
    };

    const numberEditor = (options) => {
        return <InputNumber value={options.value} onValueChange={(e) => options.editorCallback(e.target.value)} min={1} />;
    };

    const textareaEditor = (options) => {
        return <InputTextarea type="text" autoResize value={options.value} onChange={(e) => options.editorCallback(e.target.value)} />;
    };

    const categoryEditor = (options) => {
        return (
            <Dropdown
                value={options.value}
                options={categories}
                onChange={(e) => options.editorCallback(e.value)}
            />
        );
    };

    const handleClickInsert = () => {
        if (insertMode) {
            return;
        }
        setInsertMode(true);
        const newRecord = new Record();
        setRecords((prevRecords) => [newRecord, ...prevRecords]);
        setTimeout(() => {
            setEditingRows([...editingRows, newRecord]);
        }, 1);
    }

    const onRowEditChange = (event) => {
        const { data } = event;
        const activeRowArray = Array.isArray(data) ? data : [data];
        setEditingRows(activeRowArray);
    }

    const tableHeader = () => {
        return (
            <div>
                <Button variant="text" onClick={handleClickInsert} >
                    {t("insert_record_title")}
                </Button>
            </div>
        );
    }

    const dataTableRef = useRef(null);

  if (error) {
    return <div>Error: {error.message}</div>;
  } else if (!isLoaded) {
    return <div>Loading...</div>;
  } else {
    return (
      <div className="table-container" style={tableStyles}>

        <DataTable
            value={records}
            header={tableHeader}
            editMode="row"
            onRowEditChange={onRowEditChange}
            editingRows={editingRows || [false]}
            // selectionMode="multiple"
            dragSelection
            // selectionSelectable={isRowSelectable}
            onSelectionChange={(e) => setSelectedRecords(e.value)}
            selection={selectedRecords}
            rowClassName={(rowData) => (rowData.id ? '' : 'non-selectable')}
            rowGroupMode="rowspan"
        >
          <Column field="sysno" header={t('sysno')} editor={textEditor} />
          <Column field="volume_number" header={t('volume_number')} editor={textEditor} />
          <Column field="item_number" header={t('item_number')} editor={textEditor} />
          <Column field="category_name" header={t('category')} editor={categoryEditor} />
          <Column field="title" header={t('title')} editor={textareaEditor} />
          <Column field="pages_count" header={t('pages_count')} editor={numberEditor} />
          <Column field="signature" header={t('signature')} editor={textEditor} />
          <Column field="issn" header={t('issn')} editor={textEditor} />
          <Column field="isbn" header={t('isbn')} editor={textEditor} />
          <Column field="barcode" header={t('barcode')} editor={textEditor} />
          <Column field="creator" header={t('creator')} />
          <Column field={r => r.getCreatedAtFormatted()} header={t('created_at')} />
          <Column field="extractor" header={t('extractor')} />
          <Column field={r => r.getExtractedAtFormatted()} header={t('extracted_at')} />

            <Column rowEditor />
          <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
        </DataTable>

        <Paginator
          first={offset}
          rows={rows}
          rowsPerPageOptions={[10, 15, 20, 25, 50]}
          totalRecords={totalRows}
          onPageChange={handlePageChange}
          template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate={"{first} - {last} " + t('range_separator') + " {totalRecords}"}
        //   leftContent={leftContent}
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
