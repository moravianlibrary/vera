import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { TabView, TabPanel } from "primereact/tabview";
import { ProgressBar } from "primereact/progressbar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";
import InsertDocumentsFiles from "./InsertDocumentsFiles";
import { getIdentifierTypeLabel } from "../../types/Identifiers";
import LabeledComponent from "../../components/LabeledComponent";

interface InsertDocumentsValuesProps {
    onGoBack?: () => void;
    onGoNext?: () => void;
    onSkipNext?: () => void;
}

const InsertDocumentsValues: React.FC<InsertDocumentsValuesProps> = (props) => {
    const { t } = useTranslation();
    const {
        settings,
        value,
        setValue,
        fileUploadValues,
        clearFileUploadValues,
        acceptInput,
        resetInput,
        processedCount,
        responses,
    } = useInsertDocuments();

    const [accepted, setAccepted] = useState(false);

    const handleAcceptInput = async () => {
        setAccepted(true);
        acceptInput();
    };

    const handleKeyPress = (event) => {
        if (event.key === "Enter") {
            handleAcceptInput();
        }
    };

    const handleGoBack = () => {
        clearFileUploadValues();
        if (props.onGoBack) {
            props.onGoBack();
        }
    };

    useEffect(() => {
        if (accepted) {
            if (
                (fileUploadValues.length > 0 &&
                    processedCount === fileUploadValues.length) ||
                (fileUploadValues.length === 0 && processedCount === 1)
            ) {
                resetInput();
                if (responses.MultipleIssues.length > 0 && props.onGoNext) {
                    props.onGoNext();
                } else if (props.onSkipNext) {
                    props.onSkipNext();
                }
            }
        }
    }, [processedCount]);

    return (
        <div className="flex flex-column gap-5">
            <TabView>
                <TabPanel
                    className="flex flex-column gap-3"
                    header={t("documents.add.values.text-input-header")}
                    disabled={fileUploadValues.length > 0}
                >
                    <LabeledComponent
                        label={t(
                            `enums.identifier-type.${settings.identifierType}`
                        )}
                    >
                        <InputText
                            autoFocus
                            disabled={accepted}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                        />
                    </LabeledComponent>
                </TabPanel>
                <TabPanel header={t("documents.add.values.file-input-header")}>
                    <InsertDocumentsFiles />
                </TabPanel>
            </TabView>
            <div className="flex justify-content-between align-items-center p-1">
                <Button
                    icon="pi pi-caret-left"
                    outlined
                    label={t("documents.add.prev-step")}
                    onClick={handleGoBack}
                />
                {accepted && (
                    <ProgressBar
                        className="w-18rem h-1rem"
                        mode={
                            fileUploadValues.length === 0
                                ? "indeterminate"
                                : "determinate"
                        }
                        value={(
                            (processedCount / fileUploadValues.length) *
                            100
                        ).toFixed(2)}
                    />
                )}
                <Button
                    disabled={value === "" && fileUploadValues.length === 0}
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={t("documents.add.next-step")}
                    onClick={handleAcceptInput}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsValues;
