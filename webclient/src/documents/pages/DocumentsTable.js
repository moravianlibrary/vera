import { DataTable } from 'primereact/datatable';
import { categoryEditor, numberEditor, textEditor, textareaEditor } from '../../services/Editors.js';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { accessService } from '../../services/AccessService.js';

const DocumentsTable = (props) => {
    const { t } = useTranslation();

    const [categories, setCategories] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [selectedDocuments, setSelectedDocuments] = useState([]);
    const [insertMode, setInsertMode] = useState(false);

    useEffect(
        () => setDocuments(props.documents),
        [props.documents]
    );

    const isAllowedToEdit = (document) => {
        return accessService.isAllowedToEditDocument(document);
    };

    const handleLazyLoad = (e) => {
        if (props.onLazyLoad) {
            props.onLazyLoad(e);
        }
    };

    const handleDeleteDocument = (e) => {
        if (props.onDelete) {
            props.onDelete(e);
        }
    };

    const handleRowEdit = (e) => {
        if (props.onLazyLoad) {
            props.onLazyLoad(e);
        }
    };

    const deleteButton = (document) => {
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
            onRowEditComplete={handleRowEdit}
            selectionMode="multiple"
            dragSelection
            selection={selectedDocuments}
            onSelectionChange={(e) => setSelectedDocuments(e.value)}
            isDataSelectable={(event) => (!insertMode || event.index != 0) && isAllowedToEdit(event.data)}
            // rowGroupMode="rowspan"
        >
            <Column field="id" header={t('id')} />
            <Column field="sysno" header={t('sysno')} editor={textEditor} />
            <Column field="volume_number" header={t('volume_number')} editor={textEditor} />
            <Column field="category_name"
                header={t('category')}
                editor={(editorOptions) => categoryEditor({ ...editorOptions, categories })}
            />
            {/* <Column field="title" header={t('title')} body={customColumnRenderer} editor={textareaEditor} className="overflow-hidden" /> */}
            <Column field="title" header={t('title')} editor={textareaEditor} />
            <Column field="pages_count" header={t('pages_count')} editor={numberEditor} />
            <Column field="signature" header={t('signature')} editor={textEditor} />
            <Column field="barcode" header={t('barcode')} editor={textEditor} />
            <Column field="ccnb" header={t('ccnb')} editor={textEditor} />
            <Column field="isbn" header={t('isbn')} editor={textEditor} />
            <Column field="creator" header={t('creator')} />
            <Column field={r => r.getCreatedAtFormatted()} header={t('created_at')} />
            {/* <Column field="extractor" header={t('extractor')} />
            <Column field={r => r.getExtractedAtFormatted()} header={t('extracted_at')} /> */}

            <Column rowEditor />
            <Column body={deleteButton} />
            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
        </DataTable>
    );
};

export default DocumentsTable;
