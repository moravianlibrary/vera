import React, { useEffect, useRef, useState } from 'react';

import '../styles/Documents.css';
import { Dialog } from 'primereact/dialog';
import InsertDocuments from '../features/insert-documents/InsertDocuments';
import DocumentsHeader from '../features/documents/DocumentsHeader';
import DocumentsTable from '../features/documents/DocumentsTable';
import { DocumentsProvider } from '../contexts/documents/DocumentsContext';
import { AssignableCategoriesProvider } from '../contexts/categories/AssignableCategoriesContext';
import { DocumentsSearchProvider, useDocumentsSearch } from '../contexts/documents/search/DocumentsSearchContext';
import { useSearchParams } from 'react-router-dom';

const Documents: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [extractionId, setExtractionId] = useState<number | null>(null);

    useEffect(() => {
        if (searchParams.has("extractionId")) {
            setExtractionId(parseInt(searchParams.get("extractionId")!, 10));
        }
    }, [searchParams, setExtractionId]);

    return (
        <div className="table-container" >
            <AssignableCategoriesProvider>
                <DocumentsSearchProvider extractionId={extractionId}>
                    <DocumentsDiv />
                </DocumentsSearchProvider>
            </AssignableCategoriesProvider>
        </div>
    );
};

const DocumentsDiv: React.FC = () => {
    const { activeQuery } = useDocumentsSearch();

    const [insertMode, setInsertMode] = useState(false);
    const [createMode, setCreateMode] = useState(false);

    return (
        <DocumentsProvider query={activeQuery}>
            <DocumentsHeader
                onInsert={() => setInsertMode(true)}
                onCreate={() => setCreateMode(true)}
            />
            <DocumentsTable  />
            <Dialog visible={insertMode} onHide={() => setInsertMode(false)}>
                <InsertDocuments
                    onClose={() => setInsertMode(false)}
                />
            </Dialog>
        </DocumentsProvider>
    );
};

export default Documents;
