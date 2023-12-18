import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Divider } from "primereact/divider";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const RuleType = {
    GROUP: 'GROUP',
    FIELD: 'FIELD',
    TEXT_FIELD: 'TEXT_FIELD',
}

const FieldType = {
    TEXT: 'TEXT',
    NUMBER: 'NUMBER',
    CATEGORY: 'CATEGORY',
};

function getRuleBackground(level) {
    switch (level) {
        case 0: return "#7483B1";
        case 1: return "#92A1CF";
        case 2: return "#A1B0DE";
        case 3: return "#ABBAE8";
    }
};

const RuleView = (props) => {
    if (!props.data) {
        return (<div></div>);
    }

    return (
        <div>
            {props.data.type === RuleType.GROUP && <RuleGroup {...props} />}
            {props.data.type === RuleType.FIELD && <FieldRule {...props} />}        
        </div>
    );
};

const FieldRule = (props) => {
    const { t } = useTranslation();

    const [data, setData] = useState({});

    const fieldOptions = [
        {name: "sysno", type: FieldType.TEXT},
        {name: "volume_number", type: FieldType.TEXT},
        {name: "category", type: FieldType.CATEGORY},
        {name: "title", type: FieldType.TEXT},
        {name: "pages_count", type: FieldType.NUMBER},
    ];
    const [selectedField, setSelectedField] = useState({});

    const textOptions = ["equals", "starts_with", "ends_with", "contains", "not_contains", "not_equals"];
    const [textOption, setTextOption] = useState("equals");
    const numberOptions = ["equal_to", "not_equal_to", "less_than", "more_than", "between"];
    const [numberOption, setNumberOption] = useState("equal_to");

    const [textValue, setTextValue] = useState("");
    const [numberValue1, setNumberValue1] = useState(0);
    const [numberValue2, setNumberValue2] = useState(0);

    useEffect(() => {
        setData(props.data);
        if (data.field_name) {
            const field = fieldOptions.find(field => field.name === data.field_name);
            if (field) {
                setSelectedField(field);
                if (field.type === FieldType.TEXT) {
                    setTextValue(data.value);
                } else if (field.type === FieldType.NUMBER) {
                    if (Array.isArray(data.value)) {
                        setNumberValue1(data.value[0]);
                        setNumberValue1(data.value[1]);
                    } else {
                        setNumberValue1(data.value);
                    }
                }
            }
        }
    }, [props.data]);

    useEffect(() => {
        if (props.onDataUpdate) {
            data.field_name = selectedField.name;
            if (selectedField.type === FieldType.TEXT) {
                data.text_option = textOption;
                data.value = textValue;
            } else if (selectedField.type === FieldType.NUMBER) {
                data.number_option = numberOption;
                if (numberOption !== "between") {
                    data.value = numberValue1;
                } else {
                    data.value = [numberValue1, numberValue2];
                }
            }
            props.onDataUpdate(data);
        }
    }, [textValue, numberValue1, numberValue2]);

    const handleDelete = () => {
        if (props.onDelete) {
            props.onDelete(data);
        }
    };

    return (
        <div className="flex p-0 m-0 gap-1">
            <Button
                icon="pi pi-times"
                text
                severity="danger"
                onClick={handleDelete}
            />
            <Dropdown
                value={selectedField}
                onChange={(e) => setSelectedField(e.value)}
                options={fieldOptions}
                optionLabel={(option) => t(option.name)} 
                placeholder={t('select_document_field')}
            />
            {selectedField && selectedField.type && selectedField.type === FieldType.TEXT &&
            <div className="flex gap-1">
                <Dropdown
                    value={textOption}
                    onChange={(e) => setTextOption(e.value)}
                    options={textOptions}
                    optionLabel={(option) => t(option)} 
                    placeholder={t('select_text_operation')}
                />
                <InputText
                    autoFocus
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)} />
            </div>}
            {selectedField && selectedField.type && selectedField.type === FieldType.NUMBER &&
            <div className="flex align-items-center gap-1">
                <Dropdown
                    value={numberOption}
                    onChange={(e) => setNumberOption(e.value)}
                    options={numberOptions}
                    optionLabel={(option) => t(option)} 
                    placeholder={t('select_number_operation')}
                />
                <InputNumber className=""
                    autoFocus
                    value={numberValue1}
                    onValueChange={(e) => setNumberValue1(e.value)}
                    min={0} max={100000}
                    maxFractionDigits={0} />
                {numberOption === "between" &&
                <InputNumber className=""
                    value={numberValue2}
                    onValueChange={(e) => setNumberValue2(e.value)}
                    min={0} max={100000}
                    maxFractionDigits={0} />}
            </div>}
        </div>
    );
};

const RuleGroup = (props) => {
    const { t } = useTranslation();

    const [data, setData] = useState({});
    useEffect(() => {
        setData(props.data);
    }, [props.data]);

    const [lastId, setLastId] = useState(0);

    const matchOptions = ["match_all", "match_any"];
    const [selectedMatch, setSelectedMatch] = useState("match_all");

    const addNewRule = (newRule) => {
        const newData = {
            id: data.id,
            type: data.type,
            level: data.level,
            sub_rules: [...(data.sub_rules), newRule]
        };
        setData(newData);
        if (props.onDataUpdate) {
            props.onDataUpdate(newData);
        }
    };

    const handleDataUpdate = (subRule) => {
        const updatedSubRules = data.sub_rules.map(rule => {
            if (rule.id === subRule.id) {
                return subRule;
            }
            return rule;
        });

        const newData = {
            ...data,
            sub_rules: updatedSubRules,
        };
        setData(newData);

        if (props.onDataUpdate) {
            props.onDataUpdate(newData);
        }
    };

    const handleCreateRuleGroup = (e) => {
        if (data) {
            addNewRule({
                id: lastId,
                type: RuleType.GROUP,
                level: data.level + 1,
                sub_rules: []
            });
            setLastId(lastId + 1);
        }
    };
    
    const handleCreateFieldRule = (e) => {
        if (data) {
            addNewRule({
                id: lastId,
                type: RuleType.FIELD,
                level: data.level + 1,
            });
            setLastId(lastId + 1);
        }
    };

    const handleDelete = () => {
        if (props.onDelete) {
            props.onDelete(data);
        }
    };

    const handleDeleteSubRule = (subRule) => {
        const updatedSubRules = data.sub_rules.filter(rule => rule.id !== subRule.id);
        const newData = {
            ...data,
            sub_rules: updatedSubRules,
        };
        setData(newData);
    };

    const groupHeader = (
        <div className="flex justify-content-between pt-3 pl-3 pr-3">
            <Dropdown
                value={selectedMatch}
                onChange={(e) => setSelectedMatch(e.value)}
                options={matchOptions}
                optionLabel={(option) => t(option)} 
                placeholder="Select a City"
            />
            {data?.level > 0 && <Button
                icon="pi pi-times"
                text
                severity="danger"
                onClick={handleDelete}
            />}
        </div>
    );

    const groupFooter = (
        <div>
        {data?.level < 3 && 
            <div className="flex">
                <Button
                    label={t('create_field_rule')}
                    text
                    onClick={handleCreateFieldRule}
                />
                {data?.level < 2 && 
                <Button
                    label={t('create_rule_group')}
                    text
                    onClick={handleCreateRuleGroup}
                />}
            </div>}
        </div>
    );
    
    return (
        <Card
            style={{ background: getRuleBackground(props.data.level) }}
            header={groupHeader}
            footer={groupFooter}
        >
        <div className="flex flex-column gap-1 overflow-hidden">
            {data && data.sub_rules && data.sub_rules.map(rule =>
                <RuleView key={rule.id}
                    data={rule}
                    onDataUpdate={handleDataUpdate}
                    onDelete={handleDeleteSubRule} />
            )}
        </div>
        </Card>
    );
};

const AdvancedSearch = (props) => {
    const { t } = useTranslation();
    const EMPTY_FILTER = {
        level: 0,
        type: RuleType.GROUP,
        sub_rules: []
    };

    const [filter, setFilter] = useState({});

    const handleUpdateFilter = (data) => {
        setFilter(data);
    }

    const handleClearFilters = () => {
        setFilter(EMPTY_FILTER);
        localStorage.setItem('advanced_filter', JSON.stringify(EMPTY_FILTER));
        if (props.onApplyFilter) {
            props.onApplyFilter(filter);
        }
    };

    const handleApplyFilters = () => {
        localStorage.setItem('advanced_filter', JSON.stringify(filter));
        if (props.onApplyFilter) {
            props.onApplyFilter(filter);
        }
    };

    useEffect(() => {
        const filter = JSON.parse(localStorage.getItem('advanced_filter'));
        if (filter && typeof filter.level !== 'undefined') {
            setFilter(filter);
        } else {
            setFilter(EMPTY_FILTER);
        }
    }, []);

    return (
        <div className="flex flex-column gap-1 flex-grow-0">
            <div className="overflow-auto" style={{ 'max-height': '75vh' }}>
                <RuleView data={filter} onDataUpdate={handleUpdateFilter} />
            </div>
            <div className="flex justify-content-between">
                <Button
                    label={t('clear_filters')}
                    outlined
                    onClick={handleClearFilters}
                />
                <Button
                    label={t('apply_filters')}
                    outlined
                    onClick={handleApplyFilters}
                />
            </div>
        </div>
    );
};

export default AdvancedSearch;
