export const RuleType = {
    GROUP: 'GROUP',
    FIELD: 'FIELD',
    TEXT_FIELD: 'TEXT_FIELD',
    NUMBER_FIELD: 'NUMBER_FIELD',
    ENUM_FIELD: 'ENUM_FIELD',
}

export const GroupOptions = {
    MATCH_ALL: 'MATCH_ALL',
    MATCH_ANY: 'MATCH_ANY'
}

export const TextOptions = {
    EQUALS: "EQUALS",
    STARTS_WITH: "STARTS_WITH",
    ENDS_WITH: "ENDS_WITH",
    CONTAINS: "CONTAINS",
    NOT_CONTAINS: "NOT_CONTAINS",
    NOT_EQUALS: "NOT_EQUALS",
    IS_NULL: "IS_NULL",
    IS_NOT_NULL: "IS_NOT_NULL",
};

export const NumberOptions = {
    EQUAL_TO: "EQUAL_TO",
    NOT_EQUAL_TO: "NOT_EQUAL_TO",
    LESS_THAN: "LESS_THAN",
    MORE_THAN: "MORE_THAN",
    BETWEEN: "BETWEEN",
    IS_NULL: "IS_NULL",
    IS_NOT_NULL: "IS_NOT_NULL",
};

export const EnumOptions = {
    IS_IN: "IS_IN",
    IS_NOT_IN: "IS_NOT_IN",
    IS_NULL: "IS_NULL",
    IS_NOT_NULL: "IS_NOT_NULL",
};

const DEFAULT_GROUP_OPTION = GroupOptions.MATCH_ALL;
const DEFAULT_TEXT_OPTION = TextOptions.EQUALS;
const DEFAULT_NUMBER_OPTION = NumberOptions.EQUAL_TO;
const DEFAULT_ENUM_OPTION = EnumOptions.IS_IN;

export class SearchNode {
    constructor(type, level) {
        this.type = type;
        this.level = level;
    }

    toJson() {
        return {
            type: this.type,
            level: this.level
        };
    }
};

export class SearchGroup extends SearchNode {
    constructor(level, option, subRules) {
        super(RuleType.GROUP, level)
        this.option = option;
        this.subRules = subRules
            ? subRules.map(subRule => {
                switch (subRule.type) {
                    case RuleType.GROUP: return SearchGroup.fromJson(subRule);
                    case RuleType.TEXT_FIELD: return SearchTextField.fromJson(subRule);
                    case RuleType.NUMBER_FIELD: return SearchNumberField.fromJson(subRule);
                    case RuleType.ENUM_FIELD: return SearchEnumField.fromJson(subRule);
                }
            })
            : [];
    }

    static fromJson(json) {
        return new this(json.level, json.option, json.sub_rules);
    }

    toJson() {
        return {
            ...super.toJson(),
            option: this.option,
            sub_rules: this.subRules.map(subRule => subRule.toJson()),
        };
    }

    setOption(option) {
        this.option = option;
    }

    isEmpty() {
        return this.subRules?.length === 0;
    }

    createSubGroup() {
        const newGroup = new SearchGroup(this.level + 1, DEFAULT_GROUP_OPTION, []);
        this.subRules = [...this.subRules, newGroup];
    }

    createSubField() {
        const newField = new SearchField(RuleType.FIELD, this.level + 1);
        this.subRules = [...this.subRules, newField];
    }

    updateSubRule(subRule, index) {   
        const updatedSubRules = [
            ...this.subRules.slice(0, index),
            subRule,
            ...this.subRules.slice(index + 1)
        ];
        this.subRules = updatedSubRules;
    }

    deleteSubRule(index) {
        const updatedSubRules = [
            ...this.subRules.slice(0, index),
            ...this.subRules.slice(index + 1)
        ];
        this.subRules = updatedSubRules;
    }

    static getDefault(level = 0) {
        return new SearchGroup(level, DEFAULT_GROUP_OPTION, []);
    }
}

export class SearchField extends SearchNode {
    constructor(type, level, name, option, value) {
        super(type, level);
        this.name = name;
        this.option = option;
        this.value = value;
    }

    toJson() {
        console.log({
            ...super.toJson(),
            name: this.name,
            option: this.option,
            value: this.value,
        });
        return {
            ...super.toJson(),
            name: this.name,
            option: this.option,
            value: this.value,
        };
    }

    setOption(option) {
        this.option = option;
    }

    setValue(value) {
        this.value = value;
    }

    transformToTextField(name) {
        return new SearchTextField(this.level, name, DEFAULT_TEXT_OPTION, "");
    }

    transformToNumberField(name) {
        return new SearchNumberField(this.level, name, DEFAULT_NUMBER_OPTION, "");
    }

    transformToEnumField(name, defaultValue = "") {
        return new SearchEnumField(this.level, name, DEFAULT_ENUM_OPTION, defaultValue);
    }

    static getDefault(level) {
        return new SearchField(RuleType.FIELD, level, "", "", "");
    }
}

export class SearchTextField extends SearchField {
    constructor(level, name, option, value) {
        super(RuleType.TEXT_FIELD, level, name, option, value);
    }

    static fromJson(json) {
        return new this(json.level, json.name, json.option, json.value);
    }
}

export class SearchNumberField extends SearchField {
    constructor(level, name, option, value) {
        super(RuleType.NUMBER_FIELD, level, name, option, value);
    }

    static fromJson(json) {
        return new this(json.level, json.name, json.option, json.value);
    }

    setOption(option) {
        if (this.option !== NumberOptions.BETWEEN && option === NumberOptions.BETWEEN) {
            this.value = [this.value, ""];
        } else if (this.option === NumberOptions.BETWEEN && option !== NumberOptions.BETWEEN) {
            this.value = this.value[0];
        }
        super.setOption(option);
    }

    setValue(value) {
        super.value = value;
    }

    setFirstValue(value) {
        super.value = [value, super.value[1]];
    }

    setSecondValue(value) {
        super.value = [super.value[0], value];
    }
}

export class SearchEnumField extends SearchField {
    constructor(level, name, option, value) {
        super(RuleType.ENUM_FIELD, level, name, option, value);
    }

    static fromJson(json) {
        return new this(json.level, json.name, json.option, json.value);
    }
}