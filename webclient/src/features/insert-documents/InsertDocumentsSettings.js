import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";

const InsertDocumentsSettings = (props) => {
    const { t } = useTranslation();
    const { identifiers, identifier, setIdentifier, categories, category, setCategory } = useInsertDocuments();

    const handleGoNext = (e) => {
        if (props.onGoNext) {
            props.onGoNext();
        }
    }

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
            <Button
                icon="pi pi-caret-right"
                iconPos="right"
                outlined
                label={t('next_step')}
                onClick={handleGoNext}
            />
        </div>
    );
};

export default InsertDocumentsSettings;
