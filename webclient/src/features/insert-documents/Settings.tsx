import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";
import AssignableCategoryPicker from "../../components/selects/AssignableCategoryPicker";
import RequiredValueBadge from "../../components/wrappers/RequiredValueBadge";
import RequiredValuesButton from "../../components/wrappers/RequiredValuesButton";
import LabeledComponent from "../../components/wrappers/LabeledComponent";
import ExtractionPrioritySelect from "../../components/selects/ExtractionPrioritySelect";
import { IdentifierTypeSelectItems } from "../../data/factories/DropdownItemsFactory";

interface AddDocumentsSettingsProps {}

const AddDocumentsSettings: React.FC<AddDocumentsSettingsProps> = () => {
    const { t } = useTranslation("documents");
    const { goToNextStep, settings, setSettingsProperty } =
        useInsertDocuments();

    return (
        <div className="flex flex-column gap-3">
            <LabeledComponent label={t("add.settings.choose-identifier")}>
                <Dropdown
                    options={IdentifierTypeSelectItems()}
                    value={settings.identifierType}
                    onChange={(e) =>
                        setSettingsProperty("identifierType", e.value)
                    }
                />
            </LabeledComponent>
            <RequiredValueBadge
                isValueSelected={!!settings.categoryId}
                infoMessage={t("add.settings.choose-category-required")}
            >
                <LabeledComponent label={t("add.settings.choose-category")}>
                    <AssignableCategoryPicker
                        category_id={settings.categoryId}
                        callback={(categoryId) =>
                            setSettingsProperty("categoryId", categoryId)
                        }
                    />
                </LabeledComponent>
            </RequiredValueBadge>
            <LabeledComponent label={t("add.settings.insert-another")}>
                <Checkbox
                    checked={settings.insertAnother}
                    onChange={(e) =>
                        setSettingsProperty("insertAnother", e.checked!)
                    }
                />
            </LabeledComponent>
            <LabeledComponent label={t("add.settings.extraction-priority")}>
                <ExtractionPrioritySelect
                    value={settings.extractionPriority}
                    onValueChange={(priority) =>
                        setSettingsProperty("extractionPriority", priority)
                    }
                />
            </LabeledComponent>
            <div className="flex justify-content-end p-1">
                <RequiredValuesButton
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={t("add.next-step")}
                    onClick={goToNextStep}
                    requiredValues={[
                        { name: "categoryId", value: settings.categoryId },
                    ]}
                />
            </div>
        </div>
    );
};

export default AddDocumentsSettings;
