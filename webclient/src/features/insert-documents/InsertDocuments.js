import { Steps } from "primereact/steps";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Identifier from '../../documents/models/Identifier.js';
import CreateResult from '../../documents/models/CreateResult.js';
import InsertDocumentsSettings from "./InsertDocumentsSettings.js";
import InsertDocumentsValues from "../../documents/components/InsertDocumentsValues.js";
import { useData } from "../../services/Data.js";
import InsertDocumentsResult from "../../documents/components/InsertDocumentsResult.js";
import InsertDocumentsIssues from "../../documents/components/InsertDocumentsIssues.js";
import { Card } from "primereact/card";
import { ScrollPanel } from "primereact/scrollpanel";
import { InsertDocumentsProvider, useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext.js";

const InsertDocuments = (props) => {
    const { t } = useTranslation();
    const { dataService } = useData();

    const { identifiers, identifier, setIdentifier } = useInsertDocuments();

    const categories = props.categories;

    const items = [
        { label: t('insert_settings') },
        { label: t('insert_values') },
        { label: t('choose_issues') },
        { label: t('insert_result') }
    ];

    const [activeIndex, setActiveIndex] = useState(0);
    const [category, setCategory] = useState(null);

    const handleSelectSettings = (values) => {
        setIdentifier(values.identifier);
        setCategory(values.category_id);
        setActiveIndex(activeIndex + 1);
    };

    const handleSelectValues = async (values) => {
        // if (values.value) {
        //     const result = await dataService.insertDocument(identifier, values.value, category, false);
        //     if (result.create_result === CreateResult.MULTIPLE_ISSUE_CHOICES) {
        //         dataService.setMultiIssueDocuments([result]);
        //         // .filter(result => result.create_result === CreateResult.MULTIPLE_ISSUE_CHOICES);
        //         setActiveIndex(2);
        //     } else {
        //         showResults([result]);
        //         setActiveIndex(3);
        //         const hasSuccesfulInsert = result.create_result === CreateResult.SUCCESS;
        //         if (hasSuccesfulInsert && props.onInsert) {
        //             props.onInsert();
        //         }
        //     }
        // }
        setActiveIndex(activeIndex + 1);
    };

    const handleSelectIssue = (issue) => {
        console.log(category);
        dataService.selectFromMultiIssueDocument(issue, category);
    };

    // useEffect(() => {
    //     const handleCreateIssue = async (barcode) => {
    //         setCreateIssue(null);
    //         const prevCreatingIssues = creatingIssues;
    //         setCreatingIssues([...prevCreatingIssues, barcode]);

    //         const result = await dataService.insertDocument(Identifier.BARCODE, barcode, category, false);
    //         setCreatingIssues(creatingIssues.filter(b => b !== barcode));

    //         if (result.create_result === CreateResult.SUCCESS) {
    //             setCreatedIssues([...createdIssues, barcode]);
    //             if (props.onInsert) {
    //                 props.onInsert();
    //             }
    //         }
    //     };

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
            <div className="flex flex-column gap-6 overflow-hidden" style={{ 'min-width': '600px' }}>
                <Steps model={items} activeIndex={activeIndex} onSelect={(e) => setActiveIndex(e.index)} readOnly={true} />
                <div className="flex-1 overflow-auto">
                    {activeIndex === 0 &&
                    <InsertDocumentsSettings
                        categories={categories}
                        onAccept={handleSelectSettings}
                    />}
                    {activeIndex === 1 &&
                    <InsertDocumentsValues
                        onAccept={handleSelectValues}
                        onGoBack={(e) => setActiveIndex(0)}
                    />}
                    {activeIndex === 2 &&
                    <InsertDocumentsIssues
                        // onSelect={handleSelectIssue}
                        onGoBack={(e) => setActiveIndex(1)}
                        onNext={(e) => setActiveIndex(3)}
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
