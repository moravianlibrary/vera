import React, { useEffect, useRef, useState } from 'react';

import '../styles/Documents.css';
import { Dialog } from 'primereact/dialog';
import InsertDocuments from '../features/insert-documents/InsertDocuments';
import DocumentsHeader from '../features/documents/DocumentsHeader';
import DocumentsTable from '../features/documents/DocumentsTable';
import { DocumentsProvider } from '../contexts/documents/DocumentsContext';
import { AssignableCategoriesProvider } from '../contexts/categories/AssignableCategoriesContext';
import { DocumentsSearchProvider } from '../contexts/documents/search/DocumentsSearchContext';

const Documents: React.FC = () => {
    const [insertMode, setInsertMode] = useState(false);
    const [createMode, setCreateMode] = useState(false);

    return (
        <div className="table-container" >
            <AssignableCategoriesProvider>
                <DocumentsSearchProvider>
                    <DocumentsProvider>
                        <DocumentsHeader
                            onInsert={() => setInsertMode(true)}
                            onCreate={() => setCreateMode(true)}
                        />
                        <DocumentsTable />
                        <Dialog visible={insertMode} onHide={() => setInsertMode(false)}>
                            <InsertDocuments
                                onClose={() => setInsertMode(false)}
                            />
                        </Dialog>
                    </DocumentsProvider>
                </DocumentsSearchProvider>
            </AssignableCategoriesProvider>
        </div>
    );
}

export default Documents;
