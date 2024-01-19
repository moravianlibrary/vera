import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { ProgressBar } from "primereact/progressbar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";

interface InsertDocumentsValuesProps {
  onGoBack?: () => void;
  onGoNext?: () => void;
  onSkipNext?: () => void;
}

const InsertDocumentsValues: React.FC<InsertDocumentsValuesProps> = (props) => {
    const { t } = useTranslation();
    const { identifier, setValue, acceptInput, chooseIssuesDocuments } = useInsertDocuments();

    const [accepted, setAccepted] = useState(false);

    const handleAcceptInput = async () => {
        // TODO: handle situation when value and filePath are not set
        setAccepted(true);
        await acceptInput();
    };

    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            handleAcceptInput();
        }
    };

    const handleGoBack = () => {
        if (props.onGoBack) {
            props.onGoBack();
        }
    }

    useEffect(() => {
        if (accepted) {
            setAccepted(false);
            console.log(chooseIssuesDocuments);
            if (chooseIssuesDocuments.length > 0 && props.onGoNext) {
                props.onGoNext();
            } else if (props.onSkipNext) {
                props.onSkipNext();
            }
        }
    }, [chooseIssuesDocuments]);

    return (
        <div className="flex flex-column gap-5">
            {accepted && <ProgressBar mode="indeterminate" style={{ height: '6px', width: '100%' }} />}
            <div className="flex align-items-center gap-2">
                <span>{identifier.label}:</span>
                <InputText
                    autoFocus
                    disabled={accepted}
                    value={identifier.value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                />
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
            <div className="flex justify-content-between p-1">
                <Button
                    icon="pi pi-caret-left"
                    outlined
                    label={t('prev_step')}
                    onClick={handleGoBack}
                />
                <Button
                    disabled={identifier.value === ""}
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={t('next_step')}
                    onClick={handleAcceptInput}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsValues;
