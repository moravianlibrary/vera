import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { useTranslation } from "react-i18next";

import DocumentField from "../models/DocumentField";
import { useState } from "react";
import { RuleType } from "../models/SearchNodes";
import AdvancedSearchTextField from "./AdvancedSearchTextField";
import AdvancedSearchNumberField from "./AdvancedSearchNumberField";
import AdvancedSearchEnumField from "./AdvancedSearchEnumField";

const AdvancedSearchField = (props) => {
    const { t } = useTranslation();

    const { index, enums } = props;
    const [data, setData] = useState(props.data);
    const [selectedField, setSelectedField] = useState(Object.values(DocumentField).find(field => field.name === data.name));
    const [type, setType] = useState(data.type);

    const transformData = (type, name) => {
        switch (type) {
            case RuleType.TEXT_FIELD: return data.transformToTextField(name);
            case RuleType.NUMBER_FIELD: return data.transformToNumberField(name);
            case RuleType.ENUM_FIELD: return data.transformToEnumField(name);
        };
    };

    const handleChangeFieldType = (e) => {
        setSelectedField(e.value);
        setType(e.value.type);
        const newData = transformData(e.value.type, e.value.name);
        console.log(newData);
        setData(newData);
        if (props.onUpdate) {
            props.onUpdate(newData, index);
        }
    };

    const handleDelete = () => {
        if (props.onDelete) {
            props.onDelete(index);
        }
    };

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
                    options={Object.values(DocumentField)}
                    optionLabel={(option) => t(option.name)}
                    placeholder={t('select_document_field')}
                />
            </div>
            <div className="flex">
                {type === RuleType.TEXT_FIELD &&
                <AdvancedSearchTextField data={data} />}
                {type === RuleType.NUMBER_FIELD &&
                <AdvancedSearchNumberField data={data} />}
                {type === RuleType.ENUM_FIELD &&
                <AdvancedSearchEnumField data={data} enums={enums} />}
            </div>
        </div>
    );
};

export default AdvancedSearchField;
