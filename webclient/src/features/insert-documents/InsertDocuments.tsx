import { Steps } from "primereact/steps";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import InsertDocumentsSettings from "./InsertDocumentsSettings";
import InsertDocumentsValues from "./InsertDocumentsValues";
import InsertDocumentsResult from "./InsertDocumentsResult";
import InsertDocumentsIssues from "./InsertDocumentsIssues";
import { InsertDocumentsProvider } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";

interface InsertDocumentsProps {
    onClose?: () => void;
}

const InsertDocuments: React.FC<InsertDocumentsProps> = (props) => {
    const { t } = useTranslation();

    const items = [
        { label: t('insert_settings') },
        { label: t('insert_values') },
        { label: t('choose_issues') },
        { label: t('insert_result') }
    ];

    const [activeIndex, setActiveIndex] = useState(0);

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
                        onGoBack={() => setActiveIndex(0)}
                    />}
                    {activeIndex === 2 &&
                    <InsertDocumentsIssues
                        onGoNext={() => setActiveIndex(3)}
                        onGoBack={() => setActiveIndex(1)}
                    />}
                    {activeIndex === 3 &&
                    <InsertDocumentsResult
                        onRestart={() => setActiveIndex(1)}
                        onClose={handleClose}
                    />}
                </div>
            </div>
        </InsertDocumentsProvider>
    );
};

export default InsertDocuments;
