import React, { useEffect, useRef, useState } from 'react';

import './Documents.css';
import { Dialog } from 'primereact/dialog';
import InsertDocuments from './InsertDocuments.js';
import DocumentsHeader from '../components/DocumentsHeader.js';
import DocumentsTable from './DocumentsTable.js';
import { useData } from '../../services/Data.js';

const Documents = () => {
    const { dataService } = useData();

    const loadAmount = 50;

    const [categories, setCategories] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [lastLoadedIndex, setLastLoadedIndex] = useState(0);
    const [selectedDocuments, setSelectedDocuments] = useState([]);

    const [createMode, setCreateMode] = useState(false);
    const [insertMode, setInsertMode] = useState(false);

    useEffect(() => {
        const fetchDocuments = async() => {
            const response = await dataService.getDocuments(0, loadAmount);
            setDocuments(response.documents);
        };
        const fetchCategories = async() => {
            const categories = await dataService.getAssignableCategories();
            setCategories(categories);
        };
        fetchDocuments();
        fetchCategories();
    }, []);

    const handleLazyLoad = async (event) => {
        const { first, rows } = event;

        if (rows !== 0 && first + loadAmount / 2 > lastLoadedIndex) {
            let _documents = [...documents];

            const response = await dataService.getDocuments(first, loadAmount);
            setLastLoadedIndex(first + loadAmount);
            const newDocuments = response.documents || [];

            _documents = [..._documents.slice(0, first), ...newDocuments, ..._documents.slice(first + newDocuments.length)];

            setDocuments(_documents);
        }
    };

    const handleRowEdit = (event) => {
        const { data, newData, index } = event;

        newData.category_id = categories.find(category => category.name === newData.category_name).id;

        if (insertMode && index == 0) {
            dataService.createDocument(newData).then(document => {
                setInsertMode(false);
            });
        } else {
            dataService.updateDocument(newData).then(document => {
                documents[index] = document ? document : data;
            });
        }
    }

    const handleDeleteDocument = async (document) => {
        const deletedDocument = await dataService.deleteDocument(document);
        if (deletedDocument !== null) {
            const editedDocuments = documents.filter(d => d.id !== document.id);
            setDocuments(editedDocuments);
        }
    }

    const handleCancelSelectedDocuments = () => {
        setSelectedDocuments([]);
    }

    const handleDeleteSelectedDocuments = () => {
        dataService.deleteDocuments(selectedDocuments);
        setSelectedDocuments([]);
    }

    return (
      <div className="table-container" >
        <DocumentsHeader
            onCreate={() => setCreateMode(true)}
            onInsert={() => setInsertMode(true)}
            categories={categories}
        />
        <DocumentsTable
            documents={documents}
            onLazyLoad={handleLazyLoad}
            onDelete={handleDeleteDocument}
        />
        <Dialog visible={insertMode} onHide={(e) => setInsertMode(false)}>
            <InsertDocuments
                categories={categories}
            />
        </Dialog>
      </div>
    );
}

export default Documents;
