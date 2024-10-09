import { useRef } from "react";
import { useTranslation } from "react-i18next";
import InsertDocumentsSettings from "./InsertDocumentsSettings";
import InsertDocumentsValues from "./InsertDocumentsValues";
import InsertDocumentsResult from "./InsertDocumentsResult";
import InsertDocumentsIssues from "./InsertDocumentsIssues";
import { InsertDocumentsProvider } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";
import { Stepper, StepperRefAttributes } from "primereact/stepper";
import { StepperPanel } from "primereact/stepperpanel";

interface InsertDocumentsProps {
    onClose?: () => void;
}

const InsertDocuments: React.FC<InsertDocumentsProps> = (props) => {
    const { t } = useTranslation();

    const stepperRef = useRef<StepperRefAttributes>(null);

    const handleClose = () => {
        if (props.onClose) {
            props.onClose();
        }
    };

    return (
        <InsertDocumentsProvider>
            <Stepper ref={stepperRef} linear headerPosition="bottom">
                <StepperPanel header={t("insert_documents")}>
                    <InsertDocumentsSettings
                        onGoNext={() => stepperRef.current!.nextCallback()}
                    />
                </StepperPanel>
                <StepperPanel header={t("insert_documents")}>
                    <InsertDocumentsValues
                        onGoNext={() => stepperRef.current!.nextCallback()}
                        onGoBack={() => stepperRef.current!.prevCallback()}
                        onSkipNext={() => stepperRef.current!.setActiveStep(3)}
                    />
                </StepperPanel>
                <StepperPanel header={t("insert_documents")}>
                    <InsertDocumentsIssues
                        onGoNext={() => stepperRef.current!.nextCallback()}
                        onGoBack={() => stepperRef.current!.prevCallback()}
                    />
                </StepperPanel>
                <StepperPanel header={t("insert_documents")}>
                    <InsertDocumentsResult
                        onRestart={() => stepperRef.current!.setActiveStep(1)}
                        onClose={handleClose}
                    />
                </StepperPanel>
            </Stepper>
        </InsertDocumentsProvider>
    );
};

export default InsertDocuments;
