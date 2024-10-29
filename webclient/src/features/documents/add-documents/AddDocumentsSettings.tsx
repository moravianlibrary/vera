import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";
import React from "react";
import AssignableCategoryPicker from "../../../components/selects/AssignableCategoryPicker";
import RequiredValueBadge from "../../../components/wrappers/RequiredValueBadge";
import LabeledComponent from "../../../components/wrappers/LabeledComponent";
import ExtractionPrioritySelect from "../../../components/selects/ExtractionPrioritySelect";
import { useAddDocuments } from "../../../contexts/AddDocumentsContext";
import IdentifierTypeSelect from "../../../components/selects/IdentifierTypeSelect";

interface AddDocumentsSettingsProps {}

const AddDocumentsSettings: React.FC<AddDocumentsSettingsProps> = () => {
    const { t } = useTranslation("documents");
    const { settings, setSettingsProperty } = useAddDocuments();

    return (
        <div className="flex flex-column gap-3">
            <LabeledComponent label={t("add.settings.choose-identifier")}>
                <IdentifierTypeSelect
                    value={settings.identifierType}
                    callback={(value) =>
                        setSettingsProperty("identifierType", value)
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
            <LabeledComponent label={t("add.settings.extraction-priority")}>
                <ExtractionPrioritySelect
                    value={settings.extractionPriority}
                    onValueChange={(priority) =>
                        setSettingsProperty("extractionPriority", priority)
                    }
                />
            </LabeledComponent>
            <div className="flex justify-content-end p-1"></div>
        </div>
    );
};

export default AddDocumentsSettings;
