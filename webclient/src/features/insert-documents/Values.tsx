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

interface InsertDocumentsValuesProps {}

const InsertDocumentsValues: React.FC<InsertDocumentsValuesProps> = () => {
    const { t } = useTranslation("documents");
    const {
        goToNextStep,
        goToPrevStep,
        settings,
        value,
        setValue,
        fileUploadValues,
        processedCount,
        totalCount,
    } = useInsertDocuments();

    const handleKeyPress = (event) => {
        if (event.key === "Enter") {
            goToNextStep();
        }
    };

    return (
        <div className="flex flex-column gap-5">
            <TabView>
                <TabPanel
                    className="flex flex-column gap-3"
                    header={t("add.values.text-input-header")}
                    disabled={totalCount !== processedCount}
                >
                    <LabeledComponent
                        label={t(`identifier-type.${settings.identifierType}`, {
                            ns: "types",
                        })}
                    >
                        <InputText
                            autoFocus
                            disabled={totalCount !== processedCount}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                        />
                    </LabeledComponent>
                </TabPanel>
                <TabPanel
                    header={t("add.values.file-input-header")}
                    disabled={totalCount !== processedCount}
                >
                    <InsertDocumentsFiles />
                </TabPanel>
            </TabView>
            <div className="flex justify-content-between align-items-center p-1">
                <Button
                    icon="pi pi-caret-left"
                    outlined
                    label={t("add.prev-step")}
                    disabled={totalCount !== processedCount}
                    onClick={goToPrevStep}
                />
                {totalCount !== processedCount && (
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
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={t("add.next-step")}
                    disabled={
                        (value === "" && fileUploadValues.length === 0) ||
                        totalCount !== processedCount
                    }
                    onClick={goToNextStep}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsValues;
