import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import React from "react";
import { Stepper, StepperRefAttributes } from "primereact/stepper";
import { StepperPanel } from "primereact/stepperpanel";
import { Button } from "primereact/button";
import AddDocumentsSettings from "./AddDocumentsSettings";
import { useAddDocuments } from "../../../contexts/AddDocumentsContext";
import RequiredValuesButton from "../../../components/wrappers/RequiredValuesButton";
import AddDocumentsValues from "./AddDocumentsValues";
import AddDocumentsResults from "./AddDocumentsResults";
import AddDocumentsProgress from "./AddDocumentsProgress";

interface AddDocumentsStepsProps {
    initStep?: number;
    onHide?: () => void;
}

const AddDocumentsSteps: React.FC<AddDocumentsStepsProps> = ({
    initStep,
    onHide,
}) => {
    const { t } = useTranslation("documents");
    const { settings, saveSettings, removeResults, numFoundAll, numProcessed } =
        useAddDocuments();

    const [step, setStep] = useState<number>(0);
    const stepperRef = useRef<StepperRefAttributes>(undefined);

    useEffect(() => {
        if (initStep) {
            setStep(initStep);
        }
    }, []);

    const onSecondStep = () => {
        saveSettings();
        stepperRef?.current?.nextCallback();
    };

    const onRestart = () => {
        removeResults();
        stepperRef?.current?.setActiveStep(0);
    };

    const onFinish = () => {
        removeResults();
        onHide();
    };

    return (
        <div className="flex flex-column">
            <Stepper
                ref={stepperRef}
                activeStep={step}
                linear
                headerPosition="bottom"
            >
                <StepperPanel header={t("add.step.settings")}>
                    <div className="flex flex-column gap-5">
                        <AddDocumentsSettings />
                        <div className="flex justify-content-end">
                            <RequiredValuesButton
                                icon="pi pi-caret-right"
                                iconPos="right"
                                outlined
                                label={t("add.next-step")}
                                onClick={onSecondStep}
                                requiredValues={[settings.categoryId]}
                            />
                        </div>
                    </div>
                </StepperPanel>
                <StepperPanel header={t("add.step.values")}>
                    <div className="flex flex-column gap-5">
                        <AddDocumentsValues />
                        <div className="flex justify-content-between gap-3">
                            <Button
                                icon="pi pi-caret-left"
                                iconPos="left"
                                outlined
                                label={t("add.prev-step")}
                                onClick={() =>
                                    stepperRef?.current?.prevCallback()
                                }
                            />
                            <AddDocumentsProgress />
                            <Button
                                icon="pi pi-caret-right"
                                iconPos="right"
                                outlined
                                label={t("add.next-step")}
                                onClick={() =>
                                    stepperRef?.current?.nextCallback()
                                }
                            />
                        </div>
                    </div>
                </StepperPanel>
                <StepperPanel header={t("add.step.results")}>
                    <div className="flex flex-column gap-5">
                        <AddDocumentsResults />
                        <div className="flex justify-content-between gap-3">
                            <Button
                                icon="pi pi-caret-left"
                                iconPos="left"
                                outlined
                                label={t("add.prev-step")}
                                onClick={() =>
                                    stepperRef?.current?.prevCallback()
                                }
                            />
                            <AddDocumentsProgress />
                            <div className="flex gap-3">
                                <Button
                                    icon="pi pi-undo"
                                    iconPos="left"
                                    outlined
                                    label={t("add.results.restart")}
                                    onClick={onRestart}
                                    disabled={numFoundAll !== numProcessed}
                                />
                                <Button
                                    icon="pi pi-times"
                                    iconPos="left"
                                    outlined
                                    label={t("add.results.finish")}
                                    onClick={onFinish}
                                    disabled={numFoundAll !== numProcessed}
                                />
                            </div>
                        </div>
                    </div>
                </StepperPanel>
            </Stepper>
        </div>
    );
};

export default AddDocumentsSteps;
