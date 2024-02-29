import { Button } from "primereact/button";
import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { useTranslation } from "react-i18next";

import { useState } from "react";
import { SearchTreeField, SearchField, SearchNumberField, SearchTextField } from "../../../contexts/documents/search/SearchNodes";
import AdvancedSearchTextField from "./AdvancedSearchTextField";
import React from "react";
import DocumentSearchField, { DocumentField } from "../../../contexts/documents/search/DocumentSearchField";
import AdvancedSearchTreeField from "./AdvancedSearchTreeField";
import AdvancedSearchNumberField from "./AdvancedSearchNumberField";
import { RuleType } from "../../../types/SearchTypes";

interface AdvancedSearchFieldProps {
    data: SearchField;
    index: number;
    onDelete: (index: number) => void;
}

const AdvancedSearchField: React.FC<AdvancedSearchFieldProps> = ({ data, index, onDelete }) => {
    const { t } = useTranslation();

    const [selectedField, setSelectedField] = useState<DocumentField | undefined>(data.field);
    const [type, setType] = useState<RuleType>(data.type);

    const handleChangeFieldType = (event: DropdownChangeEvent) => {
        const field = DocumentSearchField[event.value];
        setSelectedField(event.value);
        data.transform(field.type, event.value);
        setType(field.type);
    };

    return (
        <div className="flex p-0 m-0 gap-1">
            <div className="p-inputgroup flex max-w-min">
                <Button
                    className="max-w-1rem"
                    icon="pi pi-times"
                    size="small"
                    outlined
                    severity="danger"
                    onClick={() => onDelete(index)}
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
                <AdvancedSearchTextField data={data as SearchTextField} />}
                {type === RuleType.NumberField &&
                <AdvancedSearchNumberField data={data as SearchNumberField} />}
                {type === RuleType.TreeField &&
                <AdvancedSearchTreeField data={data as SearchTreeField} />}
            </div>
        </div>
    );
};

export default AdvancedSearchField;
