import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Dropdown } from "primereact/dropdown";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const RuleType = {
    GROUP: 'GROUP',
    FIELD: 'FIELD',
    TEXT_FIELD: 'TEXT_FIELD',
}

function getRuleBackground(level) {
    console.log(level);
    switch (level) {
        case 0: return "bg-cyan-400";
        case 1: return "bg-cyan-500";
        case 2: return "bg-cyan-600";
    }
};

const FieldRule = (props) => {
    const { t } = useTranslation();

    const [data, setData] = useState(null);

    useEffect(() => {
        if (!props.data) {
            setData({
                level: 0,
                type: RuleType.GROUP,
                sub_rules: []
            })
        } else {
            setData(props.data);
        }
    }, [props.data])

    const fieldOptions = ["sysno", "volume_number", "category", "title"];
    const [selectedField, setSelectedField] = useState("...");

    return (
        <div>
        <Card className={getRuleBackground(data ? data.level : -1)}>
            <Dropdown
                value={selectedField}
                onChange={(e) => setSelectedField(e.value)}
                options={fieldOptions}
                optionLabel={(option) => t(option)} 
                placeholder="Select a City"
                className="w-full md:w-14rem"
            />
        </Card>
        </div>
    );
};

const RuleGroup = (props) => {
    const { t } = useTranslation();

    const [data, setData] = useState(null);

    const matchOptions = ["match_all", "match_any"];
    const [selectedMatch, setSelectedMatch] = useState("match_all");

    useEffect(() => {
        if (!props.data) {
            setData({
                level: 0,
                type: RuleType.GROUP,
                sub_rules: []
            })
        } else {
            setData(props.data);
        }
    }, [props.data])

    const addNewRule = (newRule) => {
        setData({
            type: data.type,
            level: data.level,
            sub_rules: [...(data.sub_rules), newRule]
        })
    };

    const handleCreateRuleGroup = (e) => {
        if (data) {
            addNewRule({
                type: RuleType.GROUP,
                level: data.level + 1,
                sub_rules: []
            });
        }
    };
    
    const handleCreateFieldRule = (e) => {
        if (data) {
            addNewRule({
                type: RuleType.FIELD,
                level: data.level + 1,
            });
        }
    };
    
    return (
        <div className="flex flex-column gap-1 overflow-hidden">
        <Card className={getRuleBackground(data ? data.level : -1)}>
            <Dropdown
                value={selectedMatch}
                onChange={(e) => setSelectedMatch(e.value)}
                options={matchOptions}
                optionLabel={(option) => t(option)} 
                placeholder="Select a City"
                className="w-full md:w-14rem"
            />
            {data && data.sub_rules && data.sub_rules.map(rule => {
                if (rule.type === RuleType.GROUP) {
                    return <RuleGroup data={rule} />;
                } else if (rule.type === RuleType.FIELD) {
                    return <FieldRule data={rule} />;
                } 
            })}
            <Button
                label={t('create_field_rule')}
                text
                onClick={handleCreateFieldRule}
            />
            <Button
                label={t('create_rule_group')}
                text
                onClick={handleCreateRuleGroup}
            />
        </Card>
        </div>
    );
};

const AdvancedSearch = (props) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-column gap-1">
            <RuleGroup />
        </div>
    );
};

export default AdvancedSearch;
