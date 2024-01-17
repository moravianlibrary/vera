import { Steps } from "primereact/steps";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Identifier from '../../documents/models/Identifier.js';
import CreateResult from '../../documents/models/CreateResult.js';
import InsertDocumentsSettings from "./InsertDocumentsSettings.js";
import InsertDocumentsValues from "./InsertDocumentsValues.js";
import { useData } from "../../services/Data.js";
import InsertDocumentsResult from "./InsertDocumentsResult.js";
import InsertDocumentsIssues from "./InsertDocumentsIssues.js";
import { Card } from "primereact/card";
import { ScrollPanel } from "primereact/scrollpanel";
import { InsertDocumentsProvider, useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext.js";

const InsertDocuments = (props) => {
    const { t } = useTranslation();
    const { dataService } = useData();

    // const { identifiers, identifier, setIdentifier } = useInsertDocuments();

    const categories = props.categories;

    const items = [
        { label: t('insert_settings') },
        { label: t('insert_values') },
        { label: t('choose_issues') },
        { label: t('insert_result') }
    ];

    const [activeIndex, setActiveIndex] = useState(0);
    const [category, setCategory] = useState(null);


    // useEffect(() => {
    //     const handleCreateIssue = async (barcode) => {
    //     if (createIssue !== null) {
    //         handleCreateIssue(createIssue);
    //     }
    // }, [createIssue]);

    const handleClose = () => {
        if (props.onClose) {
            props.onClose();
        }
    }

    return (
        <InsertDocumentsProvider>
            <div className="flex flex-column gap-6 overflow-hidden" style={{ 'minWidth': '600px' }}>
                <Steps model={items} activeIndex={activeIndex} onSelect={(e) => setActiveIndex(e.index)} readOnly={true} />
                <div className="flex-1 overflow-auto">
                    {activeIndex === 0 &&
                    <InsertDocumentsSettings
                        onGoNext={() => setActiveIndex(1)}
                    />}
                    {activeIndex === 1 &&
                    <InsertDocumentsValues
                        onGoNext={() => setActiveIndex(2)}
                        onSkipNext={() => setActiveIndex(3)}
                        onGoBack={(e) => setActiveIndex(0)}
                    />}
                    {activeIndex === 2 &&
                    <InsertDocumentsIssues
                        // onSelect={handleSelectIssue}
                        onGoNext={(e) => setActiveIndex(3)}
                        // onGoBack={(e) => setActiveIndex(1)}
                    />}
                    {activeIndex === 3 &&
                    <InsertDocumentsResult
                        // results={results}
                        onRestart={() => setActiveIndex(1)}
                        onClose={handleClose}
                    />}
                </div>
                {/* <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const selectedFile = e.target.files[0];
                        if (selectedFile) {
                            handleSelectFile(selectedFile);
                        }
                    }}
                /> */}
            </div>
        </InsertDocumentsProvider>
    );
};

export default InsertDocuments;
