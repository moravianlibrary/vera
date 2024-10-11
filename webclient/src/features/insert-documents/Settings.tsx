import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React, { useEffect, useState } from "react";
import AssignableCategoryPicker from "../../components/pickers/AssignableCategoryPicker";
import { useToast } from "../../contexts/ToastContext";
import { IdentifierType } from "../../types/IdentifierType";
import RequiredValueBadge from "../../components/RequiredValueBadge";
import RequiredValuesButton from "../../components/RequiredValuesButton";
import LabeledComponent from "../../components/LabeledComponent";
import ExtractionPrioritySelect from "../../components/pickers/ExtractionPrioritySelect";
import { IdentifierTypeSelectItems } from "../../data/factories/DropdownItemsFactory";

interface AddDocumentsSettingsProps {
    onGoNext: () => void;
}

const AddDocumentsSettings: React.FC<AddDocumentsSettingsProps> = (props) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { settings, onAcceptSettings } = useInsertDocuments();

    const [identifierType, setIdentifierType] = useState<IdentifierType>(
        settings.identifierType
    );
    const [categoryId, setCategoryId] = useState<number | null>(
        settings.categoryId
    );
    const [insertAnother, setInsertAnother] = useState<boolean>(
        settings.insertAnother
    );
    // TODO: extraction priority type: number 1-5
    const [extractionPriority, setExtractionPriority] = useState<number>(
        settings.extractionPriority
    );
    const [fillMissingDataManually, setFillMissingDataManually] =
        useState<boolean>(settings.fillMissingDataManually);

    const handleGoNext = () => {
        if (categoryId) {
            onAcceptSettings({
                identifierType,
                categoryId,
                insertAnother,
                extractionPriority,
                fillMissingDataManually,
            });
            props.onGoNext();
        } else {
            showToast("warn", t("Please select a category"));
        }
    };

    return (
        <div className="flex flex-column gap-3">
            <LabeledComponent
                label={t("documents.add.settings.choose-identifier")}
            >
                <Dropdown
                    options={IdentifierTypeSelectItems()}
                    value={identifierType}
                    onChange={(e) => setIdentifierType(e.value)}
                />
            </LabeledComponent>
            <RequiredValueBadge
                isValueSelected={!!categoryId}
                infoMessage={t("Please select a category")}
            >
                <LabeledComponent
                    label={t("documents.add.settings.choose-category")}
                >
                    <AssignableCategoryPicker
                        category_id={categoryId}
                        callback={setCategoryId}
                    />
                </LabeledComponent>
            </RequiredValueBadge>
            <LabeledComponent
                label={t("documents.add.settings.insert-another")}
            >
                <Checkbox
                    checked={insertAnother}
                    onChange={(e) => setInsertAnother(e.checked!)}
                />
            </LabeledComponent>
            <LabeledComponent
                label={t("documents.add.settings.extraction-priority")}
            >
                <ExtractionPrioritySelect
                    value={extractionPriority}
                    onValueChange={setExtractionPriority}
                />
            </LabeledComponent>
            <LabeledComponent
                label={t("documents.add.settings.fill-missing-data-manually")}
            >
                <Checkbox
                    checked={fillMissingDataManually}
                    onChange={(e) => setFillMissingDataManually(e.checked!)}
                />
            </LabeledComponent>
            <div className="flex justify-content-end p-1">
                <RequiredValuesButton
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={t("documents.add.next-step")}
                    onClick={handleGoNext}
                    requiredValues={[categoryId]}
                />
            </div>
        </div>
    );
};

export default AddDocumentsSettings;
