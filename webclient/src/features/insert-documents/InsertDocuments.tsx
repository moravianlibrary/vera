import { useRef } from "react";
import { useTranslation } from "react-i18next";
import InsertDocumentsValues from "./Values";
import InsertDocumentsResult from "./Results";
import InsertDocumentsIssues from "./InsertDocumentsIssues";
import { InsertDocumentsProvider } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";
import { Stepper, StepperRefAttributes } from "primereact/stepper";
import { StepperPanel } from "primereact/stepperpanel";
import AddDocumentsSettings from "./Settings";

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
                <StepperPanel header={t("documents.add.step.settings")}>
                    <AddDocumentsSettings
                        onGoNext={() => stepperRef.current!.nextCallback()}
                    />
                </StepperPanel>
                <StepperPanel header={t("documents.add.step.values")}>
                    <InsertDocumentsValues
                        onGoNext={() => stepperRef.current!.nextCallback()}
                        onGoBack={() => stepperRef.current!.prevCallback()}
                        onSkipNext={() => stepperRef.current!.setActiveStep(3)}
                    />
                </StepperPanel>
                <StepperPanel header={t("documents.add.step.issues")}>
                    <InsertDocumentsIssues
                        onGoNext={() => stepperRef.current!.nextCallback()}
                        onGoBack={() => stepperRef.current!.prevCallback()}
                    />
                </StepperPanel>
                <StepperPanel header={t("documents.add.step.results")}>
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
