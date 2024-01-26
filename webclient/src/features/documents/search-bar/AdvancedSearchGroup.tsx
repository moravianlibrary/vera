import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Dropdown } from "primereact/dropdown";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GroupOption, SearchGroup } from "../../../contexts/documents/search/SearchNodes";
import AdvancedSearchNode from "./AdvancedSearchNode";
import { setSeconds } from "date-fns";
import React from "react";

const MAX_GROUP_LEVEL = 2
const MAX_FIELD_LEVEL = MAX_GROUP_LEVEL + 1;

interface AdvancedSearchGroupProps {
    data: SearchGroup;
    index: number;
    bgColor: any;
}

const AdvancedSearchGroup: React.FC<AdvancedSearchGroupProps> = (props) => {
    const { t } = useTranslation();

    const { data, index } = props;
    const [option, setOption] = useState(props.data.option);
    const [subRules, setSubRules] = useState(props.data.subRules);

    useEffect(() => setSubRules(data.subRules), [data]);

    const handleCreateRuleGroup = (e) => {
        data.createSubGroup();
        setSubRules(data.subRules);
    };
    
    const handleCreateFieldRule = (e) => {
        data.createSubField();
        setSubRules(data.subRules);
    };

    const handleUpdateSubRule= (subRule, index) => {
        data.updateSubRule(subRule, index);
        setSubRules(data.subRules);
    };

    const handleDelete = () => {
        // if (props.onDelete) {
        //     props.onDelete(index);
        // }
    };

    const handleDeleteSubRule = (index) => {
        data.deleteSubRule(index);
        setSubRules(data.subRules);
    };

    const handleSelectOption = (e) => {
        data.setOption(e.value);
        setOption(data.option);
    };

    const groupHeader = (
        <div className="flex justify-content-between pt-3 pl-3 pr-3">
            <Dropdown
                value={option}
                onChange={handleSelectOption}
                options={Object.values(GroupOption)}
                itemTemplate={(option) => t(option)} 
                placeholder="Select a City"
            />
            {data.level > 0 && <Button
                icon="pi pi-times"
                text
                severity="danger"
                onClick={handleDelete}
            />}
        </div>
    );

    const groupFooter = (
        <div>
            {data.level < MAX_FIELD_LEVEL && 
            <div className="flex">
                <Button
                    label={t('create_field_rule')}
                    text
                    onClick={handleCreateFieldRule}
                />
                {data.level < MAX_GROUP_LEVEL && 
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
            style={{ background: props.bgColor }}
            header={groupHeader}
            footer={groupFooter}
        >
        <div className="flex flex-column gap-1 overflow-hidden">
            {subRules.map((rule, index) =>
                <AdvancedSearchNode key={`rule_${Date.now()}_${index}`}
                    data={rule}
                    // enums={enums}
                    index={index}
                    onUpdate={handleUpdateSubRule}
                    onDelete={handleDeleteSubRule} />
            )}
        </div>
        </Card>
    );
};

export default AdvancedSearchGroup;
