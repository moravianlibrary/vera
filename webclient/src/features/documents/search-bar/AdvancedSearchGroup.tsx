import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GroupOption, SearchGroup } from "../../../contexts/documents/search/SearchNodes";
import AdvancedSearchNode from "./AdvancedSearchNode";
import React from "react";

const MAX_GROUP_LEVEL = 2
const MAX_FIELD_LEVEL = MAX_GROUP_LEVEL + 1;

interface AdvancedSearchGroupProps {
    data: SearchGroup;
    index?: number;
    onDelete?: (index: number) => void;
    bgColor: string | undefined;
}

const AdvancedSearchGroup: React.FC<AdvancedSearchGroupProps> = ({ data, index, bgColor, onDelete }) => {
    const { t } = useTranslation();

    const options = Object.keys(GroupOption).map(option => (
        { value: option, label: t(option === GroupOption.MatchAll ? "Match all" : "Match any") }));
    const [option, setOption] = useState(data.option);
    const [subRules, setSubRules] = useState(data.subRules);

    useEffect(() => setSubRules(data.subRules), [data]);

    const handleCreateRuleGroup = () => {
        data.createSubGroup();
        setSubRules(data.subRules);
    };
    
    const handleCreateFieldRule = () => {
        data.createSubField();
        setSubRules(data.subRules);
    };

    const handleDeleteSubRule = (index: number) => {
        data.deleteSubRule(index);
        setSubRules(data.subRules);
    };

    const handleSelectOption = (e: DropdownChangeEvent) => {
        data.setOption(e.value);
    };

    const groupHeader = (
        <div className="flex justify-content-between pt-3 pl-3 pr-3">
            <Dropdown
                value={option}
                onChange={handleSelectOption}
                options={options}
            />
            {data.level > 0 && <Button
                icon="pi pi-times"
                text
                severity="danger"
                onClick={() => onDelete!(index!)}
            />}
        </div>
    );

    const groupFooter = (
        <div>
            {data.level < MAX_FIELD_LEVEL && 
            <div className="flex">
                <Button
                    label={t('Add rule')}
                    text
                    onClick={handleCreateFieldRule}
                />
                {data.level < MAX_GROUP_LEVEL && 
                <Button
                    label={t('Add group')}
                    text
                    onClick={handleCreateRuleGroup}
                />}
            </div>}
        </div>
    );
    
    return (
        <Card
            style={{ background: bgColor }}
            header={groupHeader}
            footer={groupFooter}
        >
        <div className="flex flex-column gap-1 overflow-hidden">
            {subRules.map((rule, index) =>
                <AdvancedSearchNode key={`rule_${Date.now()}_${index}`}
                    data={rule}
                    index={index}
                    onDelete={handleDeleteSubRule} />
            )}
        </div>
        </Card>
    );
};

export default AdvancedSearchGroup;
