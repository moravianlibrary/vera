import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";

import { useEffect, useState } from "react";
import { RuleType, SearchField } from "../../../contexts/documents/search/SearchNodes";
import AdvancedSearchTextField from "./AdvancedSearchTextField";
import AdvancedSearchNumberField from "./AdvancedSearchNumberField";
import AdvancedSearchEnumField from "./AdvancedSearchEnumField";
import React from "react";
import DocumentSearchField, { DocumentField, DocumentSearchFieldType } from "../../../contexts/documents/search/DocumentSearchField";

interface AdvancedSearchFieldProps {
    data: SearchField;
    index: number;
}

const AdvancedSearchField: React.FC<AdvancedSearchFieldProps> = ({ data, index }) => {
    const { t } = useTranslation();

    // const [selectedField, setSelectedField] = useState(Object.values(DocumentField).find(field => field.name === data.name));
    const [selectedField, setSelectedField] = useState<DocumentField | undefined>(data.field);
    const [type, setType] = useState<RuleType>(data.type);

    const handleChangeFieldType = (event) => {
        const field = DocumentSearchField[event.value];
        setSelectedField(event.value);
        data.transform(field.type, field.name);
        setType(field.type);
    };

    const handleDelete = () => {
        // if (props.onDelete) {
        //     props.onDelete(index);
        // }
    };

    useEffect(() => {
        console.log(data);
    }, [data, data.type]);

    return (
        <div className="flex p-0 m-0 gap-1">
            <div className="p-inputgroup flex">
                <Button
                    className="max-w-1rem"
                    icon="pi pi-times"
                    size="small"
                    outlined
                    severity="danger"
                    onClick={handleDelete}
                />
                <Dropdown
                    className="max-w-14rem w-14rem"
                    value={selectedField}
                    onChange={handleChangeFieldType}
                    options={Object.keys(DocumentSearchField).map(key => ({ value: key, label: t(DocumentSearchField[key].name) }))}
                    placeholder={t('select_document_field')}
                />
            </div>
            <div className="flex">
                {type === RuleType.TextField &&
                <AdvancedSearchTextField data={data} />}
                {type === RuleType.NumberField &&
                <AdvancedSearchNumberField data={data} />}
                {type === RuleType.EnumField &&
                <AdvancedSearchEnumField data={data} />}
            </div>
        </div>
    );
};

export default AdvancedSearchField;
