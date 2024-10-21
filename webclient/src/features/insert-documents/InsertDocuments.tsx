import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import InsertDocumentsValues from "./Values";
import InsertDocumentsResult from "./Results";
import InsertDocumentsIssues from "./InsertDocumentsIssues";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";
import { Stepper, StepperRefAttributes } from "primereact/stepper";
import { StepperPanel } from "primereact/stepperpanel";
import AddDocumentsSettings from "./Settings";

interface InsertDocumentsProps {
    onClose: () => void;
}

const InsertDocuments: React.FC<InsertDocumentsProps> = ({ onClose }) => {
    const { t } = useTranslation("documents");
    const { currStep } = useInsertDocuments();

    const stepperRef = useRef<StepperRefAttributes>(null);

    useEffect(() => {
        stepperRef.current?.setActiveStep(currStep);
    }, [currStep]);

    return (
        <Stepper ref={stepperRef} linear headerPosition="bottom">
            <StepperPanel header={t("add.step.settings")}>
                <AddDocumentsSettings />
            </StepperPanel>
            <StepperPanel header={t("add.step.values")}>
                <InsertDocumentsValues />
            </StepperPanel>
            <StepperPanel header={t("add.step.issues")}>
                <InsertDocumentsIssues />
            </StepperPanel>
            <StepperPanel header={t("add.step.results")}>
                <InsertDocumentsResult onClose={onClose} />
            </StepperPanel>
        </Stepper>
    );
};

export default InsertDocuments;
