import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const InsertDocumentsSettings = (props) => {
    const { t } = useTranslation();

    const options = props.options;
    const [value, setValue] = useState(options[0]);

    const categories = props.categories;
    const [category, setCategory] = useState(null);

    const handleAccept = (e) => {
        console.log(category);
        if (props.onAccept) {
            props.onAccept({
                identifier: value,
                category_id: category
            });
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
                    options={options}
                    value={value}
                    onChange={(e) => setValue(e.value)}
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
                onClick={handleAccept}
            />
        </div>
    );
};

export default InsertDocumentsSettings;
