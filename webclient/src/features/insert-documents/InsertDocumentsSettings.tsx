import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";

interface InsertDocumentsSettingsProps {
    onGoNext: () => void;
}

const InsertDocumentsSettings: React.FC<InsertDocumentsSettingsProps> = (props) => {
    const { t } = useTranslation();
    const { identifiers, identifier, setIdentifier, categories, category, setCategory } = useInsertDocuments();

    const renderLabel = (category) => {
        if (category.parent_category) {
            return `${renderLabel(category.parent_category)} > ${category.name}`;
        }
        return category.name;
    };

    return (
        <div className="flex flex-column gap-3">
            <div className="flex align-items-center gap-3">
                <span>{t('choose_identifier')}:</span>
                <Dropdown
                    options={identifiers}
                    value={identifier.value}
                    onChange={(e) => setIdentifier(e.value)}
                />
            </div>
            <div className="flex align-items-center gap-3">
                <span>{t('choose_category')}:</span>
                <Dropdown
                    options={categories.map(category => (
                        { label: renderLabel(category), value: category.id }
                    ))}
                    value={category}
                    onChange={(e) => setCategory(e.value)}
                />
            </div>
            {/* <div>
                <span>{t('')}</span>
                <Checkbox />
            </div> */}
            <div className="flex justify-content-end p-1">
                <Button
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={t('next_step')}
                    onClick={props.onGoNext}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsSettings;
