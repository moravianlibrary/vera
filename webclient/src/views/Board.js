import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from "react-i18next";

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Paginator } from 'primereact/paginator';
import { SpeedDial } from 'primereact/speeddial';
import { Tooltip } from 'primereact/tooltip';

import './Board.css';
import { dataService } from '../services/Data.js';
import { categoryEditor, numberEditor, textEditor, textareaEditor } from '../services/Editors.js';
import SelectCategoryDialog from '../dialogs/SelectEnumDialog';
import { Record } from '../models/Record.js';

const RecordsTable = () => {
    const { t } = useTranslation();

    const [records, setRecords] = useState([]);
    const [totalRows, setTotalRows] = useState(0);
    const [offset, setOffset] = useState(0);
    const [numRows, setNumRows] = useState(0);

    const [categories, setCategories] = useState([]);

    const [editingRows, setEditingRows] = useState([]);
    const [insertMode, setInsertMode] = useState(false);
    const [refreshCount, setRefreshCount] = useState(0);
    const [refreshDataCount, setRefreshDataCount] = useState(0);
    const [selectedRecords, setSelectedRecords] = useState([]);

    const [selectedFile, setSelectedFile] = useState(null);
    const [selectCategoryVisible, setSelectCategoryVisible] = useState(false);
    const fileInputRef = useRef(null);

    async function fetchRecords() {
        const { records, num_found } = await dataService.getRecords(offset, numRows);
        setRecords(records);
        setTotalRows(num_found);
    }

    async function fetchCategories() {
        const categories = await dataService.getCategories();
        setCategories(categories);
    }

    const handlePageRefresh = () => {
        setRefreshCount(refreshCount + 1);
    };
    
    const refreshData = () => {
        setRefreshDataCount(refreshDataCount + 1);
    };
  
    const handlePageChange = (event) => {
        setOffset(event.first);
        handlePageRefresh();
    }

    const handleRowEditChange = (event) => {
        const { data } = event;
        const activeRowArray = Array.isArray(data) ? data : [data];
        setEditingRows(activeRowArray);
    }

    const handleClickInsert = () => {
        if (!insertMode) {
            setOffset(0);
            setInsertMode(true);
        }
    };

    const handleClickUploadSysnoFile = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleInsertNewRecord = (restRecords) => {
        const newRecord = new Record();
        restRecords.unshift(newRecord);
        setRecords(restRecords);
        setEditingRows([...editingRows, newRecord]);
        handlePageRefresh();
    };

    const handleSelectFile = (file) => {
        if (file) {
            setSelectedFile(file);
            setSelectCategoryVisible(true);
        }
    };

    const handleSelectCategory = (category) => {
        if (selectedFile) {
            if (category) {
                dataService.createRecordsFromFile(selectedFile, category.id);
            }
            setSelectedFile(null);
        } else if (selectedRecords) {
            selectedRecords.map(record => {return {...record, category_id: category.id};})
                .forEach(record => dataService.updateRecord(record));
            setSelectedRecords([]);
            refreshData();
        }
    };

    const handleRowEdit = (event) => {
        const { data, newData, index } = event;

        newData.category_id = categories.find(category => category.name === newData.category_name).id;

        if (insertMode && index == 0) {
            dataService.createRecord(newData).then(record => {
                setInsertMode(false);
            });
        } else {
            dataService.updateRecord(newData).then(record => {
                records[index] = record ? record : data;
                handlePageRefresh();
            });
        }
    }

    const handleRowEditCancel = (event) => {
        if (insertMode && event.index == 0) {
            setInsertMode(false);
        }
    };

    const handleDeleteRecord = (record) => {
        dataService.deleteRecord(record);
        refreshData();
    }

    const handleDeleteSelectedRecords = () => {
        dataService.deleteRecords(selectedRecords);
        setSelectedRecords([]);
        refreshData();
    }

    useEffect(() => {
        const handleResize = () => {
            const rowHeight = 80;
            const remainingHeight = window.innerHeight - 250;
            setNumRows(Math.max(5, Math.floor(remainingHeight / rowHeight)));
        };
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        fetchRecords();
        fetchCategories();
    }, [offset, numRows, refreshDataCount]);

    useEffect(() => {
        async function insertRecordToPage() {
            const { records, num_found } = await dataService.getRecords(offset, numRows - 1);
            setTotalRows(num_found);
            handleInsertNewRecord(records);
        }
        if (insertMode) {
            insertRecordToPage();
        } else {
            fetchRecords();
        }
    }, [insertMode]);

    const tableHeader = () => {
        const items = [
            {
                label: t('insert_record_title'),
                icon: 'pi pi-plus',
                command: handleClickInsert
            },
            {
                label: t('insert_records_from_file'),
                icon: 'pi pi-upload',
                command: handleClickUploadSysnoFile
            },
        ];

        return (
            <div className="flex flex-wrap align-items-center justify-content-between gap-2">
                {/* <Button icon="pi pi-plus" rounded raised onClick={handleClickInsert} /> */}
                <div>
                    <div>
                        <Tooltip target=".speeddial-top-left .p-speeddial-action" position="left" />
                        <SpeedDial model={items}
                            direction="down"
                            style={{ left: 10, top: 10 }}
                            size="large"
                            className="speeddial-top-left"
                        />
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                const selectedFile = e.target.files[0];
                                if (selectedFile) {
                                    handleSelectFile(selectedFile);
                                }
                            }}
                        />;
                        <SelectCategoryDialog
                            visible={selectCategoryVisible}
                            title={t('select_category_title')}
                            values={categories}
                            onHide={() => setSelectCategoryVisible(false)}
                            onSelect={handleSelectCategory}
                        />
                    </div>
                </div>
                <div>
                    <Button icon="pi pi-pencil"
                        className="p-button-rounded p-button-text"
                        severity={selectedRecords.length > 0 ? "primary" : "secondary"}
                        disabled={selectedRecords.length == 0}
                        onClick={() => setSelectCategoryVisible(true)}
                    />
                    <Button icon="pi pi-trash" 
                        className="p-button-rounded p-button-text"
                        severity={selectedRecords.length > 0 ? "danger" : "secondary"}
                        disabled={selectedRecords.length == 0}
                        onClick={handleDeleteSelectedRecords}
                    />
                </div>
            </div>
        );
    }

    const deleteButton = (record) => {
        if (!insertMode || record.id) {
            return (
                <Button className="p-button-rounded p-button-text p-button-danger" icon="pi pi-trash" onClick={() => handleDeleteRecord(record)} />
            );
        }
    };

    const footerEditButtons = () => {
        return (
            <Button type="button" icon="pi pi-star" className="p-button-outlined" />
        );
    };

    return (
      <div className="table-container" >

        <DataTable
            value={records}
            key={refreshCount}
            header={tableHeader}
            editMode="row"
            onRowEditChange={handleRowEditChange}
            onRowEditComplete={handleRowEdit}
            onRowEditCancel={handleRowEditCancel}
            editingRows={editingRows || [false]}
            selectionMode="multiple"
            dragSelection
            selection={selectedRecords}
            onSelectionChange={(e) => setSelectedRecords(e.value)}
            isDataSelectable={(event) => !insertMode || event.index != 0}
            rowClassName={(rowData) => (rowData.id ? '' : 'non-selectable')}
            rowGroupMode="rowspan"
        >
            <Column field="sysno" header={t('sysno')} editor={textEditor} />
            <Column field="volume_number" header={t('volume_number')} editor={textEditor} />
            <Column field="item_number" header={t('item_number')} editor={textEditor} />
            <Column field="category_name"
                header={t('category')}
                editor={(editorOptions) => categoryEditor({ ...editorOptions, categories })}
            />
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
            <Column body={deleteButton} />
            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
        </DataTable>

        <Paginator
            first={offset}
            rows={numRows}
            totalRecords={totalRows}
            onPageChange={handlePageChange}
            template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate={"{first} - {last} " + t('range_separator') + " {totalRecords}"}
            // rightContent={footerEditButtons}
        />
      </div>
    );
}

export default RecordsTable;
