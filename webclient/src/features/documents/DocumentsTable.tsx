import { DataTable, DataTableRowEditCompleteEvent, DataTableSelectionMultipleChangeEvent, DataTableValueArray } from 'primereact/datatable';
import { categoryEditor, numberEditor, textEditor, textareaEditor } from '../../services/Editors.js';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { accessService } from '../../services/AccessService';
import { useUser } from '../../contexts/user/UserContext';
import { useDocuments } from '../../contexts/documents/DocumentsContext';
import { Document } from '../../adapters/ApiDocuments';
import DocumentModel from '../../contexts/documents/DocumentModel.js';

interface DocumentsTableProps {
}

const DocumentsTable: React.FC<DocumentsTableProps> = (props) => {
    const { t } = useTranslation();

    const { documents, handleLazyLoad, handleDeleteDocument, handleUpdateDocument, selectedDocuments, handleSelectDocuments } = useDocuments();
    const { user } = useUser();
    const [categories, setCategories] = useState([]);
    const [insertMode, setInsertMode] = useState(false);

    const isAllowedToEdit = (document: Document) => {
        return accessService.isAllowedToEditDocument(user, document);
    };

    const deleteButton = (document: DocumentModel) => {
        if (!insertMode || document.id) {
            return (
                <Button className="p-button-rounded p-button-text"
                    severity={isAllowedToEdit(document) ? "danger" : "secondary"}
                    disabled={!isAllowedToEdit(document)}
                    icon="pi pi-trash"
                    onClick={() => handleDeleteDocument(document)}
                />
            );
        }
    };

    const handleRowEditComplete = (event: DataTableRowEditCompleteEvent) => {
        handleUpdateDocument(event.newData as DocumentModel, event.index);
    };

    const handleSelectionChange = (event: DataTableSelectionMultipleChangeEvent<DataTableValueArray>) => {
        const selectedDocuments: DocumentModel[] = event.value.map((selectedItem) => {
            return selectedItem as DocumentModel;
        });
        handleSelectDocuments(selectedDocuments);
    };

    const pagesCountBody = (document: DocumentModel) => {
        return document.pages_count
                ? document.pages_count_predicted
                        ? `${document.pages_count} (${document.pages_count_predicted})`
                        : document.pages_count
                : document.pages_count_predicted
                        ? `(${document.pages_count_predicted})`
                        : null;
    };

    return (
        <DataTable
            className='documents-table'
            value={documents}
            // key={refreshCount}
            // header={tableHeader}
            // resizableColumns
            // columnResizeMode="fit"
            scrollable
            // scrollHeight="flex"
            scrollHeight="calc(100vh - 150px)"
            virtualScrollerOptions={{ lazy: true, onLazyLoad: handleLazyLoad, itemSize: 81, delay: 0 }}
            editMode="row"
            onRowEditComplete={handleRowEditComplete}
            selectionMode="multiple"
            // dragSelection
            selection={selectedDocuments}
            onSelectionChange={handleSelectionChange}
            // isDataSelectable={(event) => (!insertMode || event.index != 0) && isAllowedToEdit(event.data)}
            // rowGroupMode="rowspan"
        >
            <Column field="id" header={t('id')} />
            <Column field="sysno" header={t('sysno')} editor={textEditor} />
            <Column field='volume_number' header={t('volume_number')} editor={textEditor} />
            <Column field="category_name"
                header={t('category')}
                editor={(editorOptions) => categoryEditor({ ...editorOptions, categories })}
            />
            {/* <Column field="title" header={t('title')} body={customColumnRenderer} editor={textareaEditor} className="overflow-hidden" /> */}
            <Column field='title' header={t('title')} editor={textareaEditor} />
            <Column field='pages_count' body={pagesCountBody} header={t('pages_count')} editor={numberEditor} />
            <Column field='signature' header={t('signature')} editor={textEditor} />
            <Column field="barcode" header={t('barcode')} editor={textEditor} />
            <Column field="ccnb" header={t('ccnb')} editor={textEditor} />
            <Column field="isbn" header={t('isbn')} editor={textEditor} />
            <Column field="creator" header={t('creator')} />
            <Column field='created_at' header={t('created_at')} />
            {/* <Column field="extractor" header={t('extractor')} />
            <Column field={r => r.getExtractedAtFormatted()} header={t('extracted_at')} /> */}

            <Column rowEditor />
            <Column body={deleteButton} />
            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
        </DataTable>
    );
};

export default DocumentsTable;
