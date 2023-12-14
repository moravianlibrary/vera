import { Steps } from "primereact/steps";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Identifier from '../models/Identifier.js';
import CreateResult from '../models/CreateResult.js';
import InsertDocumentsSettings from "../components/InsertDocumentsSettings.js";
import { Button } from "primereact/button";
import InsertDocumentsValues from "../components/InsertDocumentsValues.js";
import { dataService } from "../../services/Data.js";
import InsertDocumentsResult from "../components/InsertDocumentsResult.js";
import InsertDocumentsIssues from "../components/InsertDocumentsIssues.js";

const InsertDocuments = (props) => {
    const { t } = useTranslation();

    const identifiers = [Identifier.SYSNO, Identifier.BARCODE];
    const categories = props.categories;

    const items = [
        { label: t('insert_settings') },
        { label: t('insert_values') },
        { label: t('choose_issues') },
        { label: t('insert_result') }
    ];

    const [activeIndex, setActiveIndex] = useState(0);
    const [identifier, setIdentifier] = useState(identifiers[0]);
    const [category, setCategory] = useState(null);

    const [results, showResults] = useState([]);

    const handleSelectSettings = (values) => {
        setIdentifier(values.identifier);
        setActiveIndex(activeIndex + 1);
    };

    const handleSelectValues = async (values) => {
        setActiveIndex(activeIndex + 1);
        if (values.value) {
            const result = await dataService.insertDocument(identifier, values.value, category, false);
            showResults([result]);
            if (result.create_result == CreateResult.MULTIPLE_ISSUE_CHOICES) {
                setActiveIndex(2);
            } else {
                setActiveIndex(3);
                const hasSuccesfulInsert = result.create_result === CreateResult.SUCCESS;
                if (hasSuccesfulInsert && props.onInsert) {
                    props.onInsert();
                }
            }
        }
    };

    const handleClose = () => {
        if (props.onClose) {
            props.onClose();
        }
    }

    return (
        <div className="flex flex-column gap-6">
            <Steps model={items} activeIndex={activeIndex} onSelect={(e) => setActiveIndex(e.index)} readOnly={true} />
            {activeIndex === 0 &&
            <InsertDocumentsSettings
                options={identifiers}
                categories={categories}
                onAccept={handleSelectSettings}
            />}
            {activeIndex === 1 &&
            <InsertDocumentsValues
                identifierName={identifier.toLowerCase()}
                onAccept={handleSelectValues}
                onGoBack={(e) => setActiveIndex(0)}
            />}
            {activeIndex === 2 &&
            <InsertDocumentsIssues
                results={results}
            />}
            {activeIndex === 3 &&
            <InsertDocumentsResult
                results={results}
                onRestart={() => setActiveIndex(1)}
                onClose={handleClose}
            />}
        </div>
    );
};

export default InsertDocuments;
