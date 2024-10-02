import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";
import { getLocalizedIdentifiers } from "../../types/Identifiers";
import AssignableCategoryPicker from "../../components/pickers/AssignableCategoryPicker";
import { useToast } from "../../contexts/ToastContext";
import { IdentifierType } from "../../types/IdentifierType";
import RequiredValueBadge from "../../components/RequiredValueBadge";
import RequiredValuesButton from "../../components/RequiredValuesButton";

interface InsertDocumentsSettingsProps {
    onGoNext: () => void;
}

interface InsertDocumentsSettingsUserValues {
    identifier: IdentifierType;
    category_id: number | null;
    insert_another: boolean;
}

const InsertDocumentsSettings: React.FC<InsertDocumentsSettingsProps> = (
    props
) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const {
        identifier,
        setIdentifier,
        category,
        setCategory,
        insertAnother,
        setInsertAnother,
    } = useInsertDocuments();

    const handleGoNext = () => {
        if (category) {
            props.onGoNext();
        } else {
            showToast("warn", t("Please select a category"));
        }
    };

    return (
        <div className="flex flex-column gap-3">
            <div className="flex align-items-center gap-3">
                <span>{t("choose_identifier")}:</span>
                <Dropdown
                    options={getLocalizedIdentifiers(t)}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.value)}
                />
            </div>
            <RequiredValueBadge
                isValueSelected={!!category}
                infoMessage={t("Please select a category")}
            >
                <div className="flex align-items-center gap-3 w-min">
                    <span>{t("choose_category")}:</span>
                    <AssignableCategoryPicker
                        category_id={category}
                        callback={setCategory}
                    />
                </div>
            </RequiredValueBadge>
            <div className="flex align-items-center gap-3">
                <span>{t("Insert another upon successful insertion")}:</span>
                <Checkbox
                    checked={insertAnother}
                    onChange={(e) => setInsertAnother(e.checked!)}
                />
            </div>
            <div className="flex justify-content-end p-1">
                <RequiredValuesButton
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={t("next_step")}
                    onClick={handleGoNext}
                    requiredValues={[category]}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsSettings;
