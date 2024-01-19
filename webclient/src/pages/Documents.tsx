import React, { useEffect, useRef, useState } from 'react';

import '../styles/Documents.css';
import { Dialog } from 'primereact/dialog';
import InsertDocuments from '../features/insert-documents/InsertDocuments';
import DocumentsHeader from '../features/documents/DocumentsHeader';
import DocumentsTable from '../features/documents/DocumentsTable';
import { DocumentsProvider } from '../contexts/documents/DocumentsContext';

const Documents: React.FC = () => {
    // const { dataService } = useData();

    // const loadAmount = 50;

    // const [categories, setCategories] = useState([]);
    // const [documents, setDocuments] = useState([]);
    // const [lastLoadedIndex, setLastLoadedIndex] = useState(0);
    // const [selectedDocuments, setSelectedDocuments] = useState([]);

    // const [createMode, setCreateMode] = useState(false);
    const [insertMode, setInsertMode] = useState(false);

    // const handleCancelSelectedDocuments = () => {
    //     setSelectedDocuments([]);
    // }

    // const handleDeleteSelectedDocuments = () => {
    //     dataService.deleteDocuments(selectedDocuments);
    //     setSelectedDocuments([]);
    // }

    return (
        <div className="table-container" >
            <DocumentsProvider>
                <DocumentsHeader
                    // onCreate={() => setCreateMode(true)}
                    onInsert={() => setInsertMode(true)}
                    // categories={categories}
                />
                <DocumentsTable
                    // documents={documents}
                    // onLazyLoad={handleLazyLoad}
                    // onDelete={handleDeleteDocument}
                />
                <Dialog visible={insertMode} onHide={() => setInsertMode(false)}>
                    <InsertDocuments
                        onClose={() => setInsertMode(false)}
                    />
                </Dialog>
            </DocumentsProvider>
        </div>
    );
}

export default Documents;
