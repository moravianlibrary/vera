import { DataTable, DataTableRowEditCompleteEvent, DataTableRowEditEvent, DataTableSelectionMultipleChangeEvent, DataTableValueArray } from 'primereact/datatable';
import { CategoryEditor, IssuanceTypeEditor, MaterialTypeEditor, numberEditor, textEditor, textareaEditor } from '../../services/Editors.js';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { accessService } from '../../services/AccessService';
import { useUser } from '../../contexts/user/UserContext';
import { useDocuments } from '../../contexts/documents/DocumentsContext';
import { Document } from '../../adapters/ApiDocuments';
import DocumentModel from '../../contexts/documents/DocumentModel.js';
import { MaterialType } from '../../types/MaterialType.js';
import { Tooltip } from 'primereact/tooltip';
import { OverlayPanel } from 'primereact/overlaypanel';
import { useOverlayScrollListener } from 'primereact/hooks';
import { Menu } from 'primereact/menu';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToast } from '../../contexts/toast/ToastContext';


interface DocumentsTableProps {
}

interface DocumentDetailsProps {
    document: DocumentModel;
}

interface DocumentDetailsBodyProps {
    document: DocumentModel;
}

const DocumentsTable: React.FC<DocumentsTableProps> = (props) => {
    const { t } = useTranslation();

    const {
        documents,
        handleLazyLoad,
        handleDeleteDocument,
        handleUpdateDocument,
        selectedDocuments,
        handleSelectDocuments,
        handleSelectAllDocuments,
        selectAll
    } = useDocuments();
    const { user } = useUser();
    const [categories, setCategories] = useState([]);
    const [insertMode, setInsertMode] = useState(false);

    const [expandedRows, setExpandedRows] = useState<DocumentModel[]>([]);

    const handleRowExpand = (e: DataTableRowEditEvent) => {
        setExpandedRows([...expandedRows, e.data as DocumentModel]);
    };

    const handleRowCollapse = (e: DataTableRowEditEvent) => {
        setExpandedRows(expandedRows.filter(row => row.id !== e.data.id));
    };

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
        if (event.type === 'all') {
            handleSelectAllDocuments();
            return;
        }
        if (selectAll) {
            handleSelectAllDocuments();
        }

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

    const titleBody = (document: DocumentModel) => {
        const titleStyle: any = {
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
        };
        return (
            <span style={titleStyle} className='overflow-ellipsis'>
                {document.title}
            </span>
        );
    };

    const typeBody = (document: DocumentModel) => {
        return document.issuance_type
            ? `${t(document.material_type)} - ${t(document.issuance_type)}`
            : t(document.material_type);
    };

    const descriptionBody = (document: DocumentModel) => {
        return [document.year, document.volume, document.bundle].filter(x => x).join(' ');
    };

    return (
        <DataTable
            className='documents-table'
            value={documents}
            // header={tableHeader}
            // resizableColumns
            // columnResizeMode="fit"
            scrollable
            // scrollHeight="flex"
            scrollHeight="calc(100vh - 150px)"
            virtualScrollerOptions={{ lazy: true, onLazyLoad: handleLazyLoad, itemSize: 81, delay: 0 }}
            onScroll={e => (e.target)}
            selectionMode="checkbox"
            selection={selectedDocuments}
            onSelectionChange={handleSelectionChange}
        >
            <Column field='details' body={document => <DocumentDetailsBody document={document} />} />
            <Column field="sysno" header={t('sysno')} />
            <Column field="type" header={t('Type')} body={typeBody} />
            <Column field='description' header={t('Description')} body={descriptionBody} />
            <Column field="category_name"
                header={t('category')}
            />
            <Column field='title' header={t('title')} body={titleBody} />
            <Column field='pages_count' body={pagesCountBody} header={t('pages_count')} />
            <Column field='signature' header={t('Signature')} />
            <Column field="barcode" header={t('Barcode')} />
            <Column field="cnb" header={t('CNB')} />
            <Column field="creator" header={t('creator')} />
            <Column field='created_at' header={t('created_at')} />

            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
        </DataTable>
    );
};

const DocumentDetailsBody: React.FC<DocumentDetailsBodyProps> = ({ document: doc }) => {
    const { t } = useTranslation();
    const { handleDeleteDocument } = useDocuments();

    const op = useRef<OverlayPanel>(null);
    const [confirmVisible, setConfirmVisible] = useState(false);

    const handleAcceptDelete = () => {
        handleDeleteDocument(doc)
        op.current!.hide();
    }

    return (
        <div className='document-details-body flex' style={{ position: 'relative' }}>
            <Button className='details-button'
                text
                onClick={(event) => op.current!.toggle(event)}
            >
                {/* <i className='pi pi-info-circle'/> */}
                <i className='pi pi-book'/>
                {/* <i className='pi pi-ellipsis-v'/> */}
            </Button>
            <OverlayPanel
                ref={op}
                // style={{ maxWidth: '500px' }}
                style={{ width: '500px' }}
                showCloseIcon
                appendTo={document.getElementById('.documents-details-body') as HTMLElement}
                // appendTo='self'
            >
                <div className='flex flex-column gap-3 align-items-start'>
                    <DocumentDetailsTooltip document={doc} />
                    <Button
                        icon="pi pi-trash"
                        severity='danger'
                        outlined
                        label={t('Delete')}
                        onClick={() => setConfirmVisible(true)}
                    />
                    <ConfirmDialog
                        // group="declarative"
                        visible={confirmVisible}
                        onHide={() => setConfirmVisible(false)}
                        header={t('Delete document')}
                        message={t("Are you sure you want to delete this document?")}
                        icon="pi pi-exclamation-triangle"
                        acceptLabel={t('Delete')}
                        acceptClassName='p-button-danger'
                        rejectLabel={t('Cancel')}
                        accept={handleAcceptDelete}
                    />
                </div>
            </OverlayPanel>
        </div>
    );
};

const DocumentDetailsTooltip: React.FC<DocumentDetailsProps> = ({ document }) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const copyToClipboard = (value: string) => {
        navigator.clipboard.writeText(value);
        showToast("info", t("Copied to clipboard"), "");
    };

    return (
        <div>
            {document.getTooltipFieldList(t).map(field => {
                return (
                    <div key={field.label} className='flex justify-content-between gap-8'>
                        <label>{t(field.label)}:</label>
                        <div className='flex justify-content-between gap-1'>
                            <span className='p-1 max-w-19rem'>{field.value as string}</span>
                            <Button
                                className='p-0 text-xs align-content-center'
                                severity='info'
                                text
                                onClick={() => copyToClipboard(field.value as string)}
                            >
                                <i className='pi pi-copy p-0' />
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>      
    );
};

const DocumentDetails: React.FC<DocumentDetailsProps> = ({ document }) => {
    const { t } = useTranslation();

    const data = [
        {'field': "System number", 'value': document.sysno},
        {'field': "Material type", 'value': document.material_type, editor: MaterialTypeEditor},
        {'field': "Volume number", 'value': document.volume},
        {'field': "Bundle", 'value': document.bundle},
        {'field': "Volume year", 'value': document.year},
        {'field': "Issuance type", 'value': document.issuance_type, editor: IssuanceTypeEditor},
        {'field': "Category", 'value': document.category_name, editor: CategoryEditor},
        {'field': "Barcode", 'value': document.barcode},
        {'field': "CNB", 'value': document.cnb},
        {'field': "ISBN/ISSN", 'value': document.isbn_issn},
        {'field': "Signature", 'value': document.signature},
        {'field': "Title", 'value': document.title},
        {'field': "Digitization state", 'value': document.digitization_state, editable: false},
        {'field': "Pages count", 'value': document.pages_count},
        {'field': "Pages count predicted", 'value': document.pages_count_predicted},
        {'field': "Size", 'value': document.size},
        {'field': "Publisher", 'value': document.publisher},
        {'field': "Publishing place", 'value': document.publishing_place},
        {'field': "Publishing year", 'value': document.publishing_year},
        {'field': "Languages", 'value': document.languages},
        {'field': "Frequencies", 'value': document.frequencies},
        {'field': "Creator", 'value': document.creator},
        {'field': "Creator department", 'value': document.department},
        {'field': "Created at", 'value': document.created_at},
        {'field': "Extraction id", 'value': document.extraction_id},
        {'field': "Extractor", 'value': document.extractor},
        {'field': "Extracted at", 'value': document.extracted_at},
    ];

    const cellEditor = (options) => {
        if (!options.rowData || options.rowData.editable === false) {
            return;
        }
        return options.rowData.editor ? options.rowData.editor(options) : textEditor(options);
    };

    const handleCellEditComplete = (e) => {
        console.log(e.newRowData);
    };

    return (
        <DataTable value={data}
            editMode='cell'
        >
            <Column field="field" header={t('Field')} />
            <Column field="value"
                header={t('Value')}
                // body={row => <DocumentDetailsBody />}
                // editor={(options) => cellEditor(options)}
                // onCellEditComplete={handleCellEditComplete}
            />
        </DataTable>
    );
};

export default DocumentsTable;
