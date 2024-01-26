import { fi } from "date-fns/locale";
import { DocumentField } from "./DocumentSearchField";

export enum RuleType {
    Group = 'Group',
    Field = 'Field',
    TextField = 'TextField',
    NumberField = 'NumberField',
    TreeField = 'TreeField',
}

export enum GroupOption {
    MatchAll = 'MatchAll',
    MatchAny = 'MatchAny'
}

export enum TextOption {
    Equals = "Equals",
    StartsWith = "StartsWith",
    EndsWith = "EndsWith",
    Contains = "Contains",
    NotContains = "NotContains",
    NotEquals = "NotEquals",
    IsNull = "IsNull",
    IsNotNull = "IsNotNull",
};

export enum NumberOption {
    EqualTo = "EqualTo",
    NotEqualTo = "NotEqualTo",
    LessThan = "LessThan",
    MoreThan = "MoreThan",
    Between = "Between",
    IsNull = "IsNull",
    IsNotNull = "IsNotNull",
};

export enum TreeOption {
    IsIn = "IsIn",
    IsNotIn = "IsNotIn",
    IsNull = "IsNull",
    IsNotNull = "IsNotNull",
};

type SubRule = SearchGroup | SearchField;

interface SearchGroupParams {
    level: number;
    option: GroupOption;
    subRules: SubRule[];
}

type FieldOption = TextOption | NumberOption | TreeOption | undefined;
type Value = string | number | [number | undefined, number | undefined] | undefined;

interface SearchFieldParams {
    level: number;
    field: DocumentField | undefined;
    option: FieldOption;
    value: Value;
}

const DEFAULT_GROUP_OPTION = GroupOption.MatchAll;
const DEFAULT_FIELDS_OPTIONS: Record<RuleType, FieldOption> = {
    [RuleType.TextField]: TextOption.Equals,
    [RuleType.NumberField]: NumberOption.EqualTo,
    [RuleType.TreeField]: TreeOption.IsIn,
    [RuleType.Group]: undefined,
    [RuleType.Field]: undefined,
};

export class SearchNode {
    type: RuleType;
    level: number;

    constructor(type: RuleType, level: number) {
        this.type = type;
        this.level = level;
    }
};

export class SearchGroup extends SearchNode {
    option: GroupOption;
    subRules: SubRule[];

    constructor(params: SearchGroupParams) {
        super(RuleType.Group, params.level)
        this.option = params.option;
        this.subRules = params.subRules
            ? params.subRules.map(subRule => {
                switch (subRule.type) {
                    case RuleType.Group: return new SearchGroup(subRule as SearchGroupParams);
                    case RuleType.TextField: return new SearchTextField(subRule as SearchFieldParams);
                    case RuleType.NumberField: return new SearchNumberField(subRule as SearchFieldParams);
                    case RuleType.TreeField: return new SearchTreeField(subRule as SearchFieldParams);
                    default:
                        throw new Error(`Unsupported rule type: ${subRule.type}`);
                }
            })
            : [];
    }

    setOption(option: GroupOption) {
        this.option = option;
    }

    isEmpty() {
        return this.subRules?.length === 0;
    }

    createSubGroup() {
        const newGroup = new SearchGroup({ level: this.level + 1, option: DEFAULT_GROUP_OPTION, subRules: [] });
        this.subRules = [...this.subRules, newGroup];
    }

    createSubField() {
        const newField = SearchField.create(RuleType.Field, this.level + 1);
        this.subRules = [...this.subRules, newField];
    }

    updateSubRule(subRule: SubRule, index: number) {   
        const updatedSubRules = [
            ...this.subRules.slice(0, index),
            subRule,
            ...this.subRules.slice(index + 1)
        ];
        console.log(this.subRules);
        console.log(updatedSubRules);
        this.subRules = updatedSubRules;
    }

    deleteSubRule(index) {
        const updatedSubRules = [
            ...this.subRules.slice(0, index),
            ...this.subRules.slice(index + 1)
        ];
        this.subRules = updatedSubRules;
    }

    static init() {
        const saved = localStorage.getItem('advanced_search');
        return saved
                ? new SearchGroup(JSON.parse(saved) as SearchGroupParams)
                : new SearchGroup({ level: 0, option: DEFAULT_GROUP_OPTION, subRules: [] });
    }
}

export class SearchField extends SearchNode {
    field: DocumentField | undefined;
    option: FieldOption;
    value: Value;

    constructor(type: RuleType, params: SearchFieldParams) {
        super(type, params.level);
        this.field = params.field;
        this.option = params.option;
        this.value = params.value;
    }

    static create(type: RuleType, level: number, field: DocumentField | undefined = undefined, option: FieldOption = undefined, value: Value = undefined) {
        return new SearchField(type, { level: level, field: field, option: option, value: value });
    }

    static default(level: number) {
        return SearchField.create(RuleType.Field, level);
    }

    setOption(option: FieldOption) {
        this.option = option;
    }

    setValue(value: Value) {
        this.value = value;
    }

    transform(type: RuleType, field: DocumentField, value: Value = undefined) {
        this.type = type;
        this.field = field;
        this.option = DEFAULT_FIELDS_OPTIONS[type];
        this.value = value;
    }
}

export class SearchTextField extends SearchField {
    constructor(params: SearchFieldParams) {
        super(RuleType.TextField, params);
    }
}

export class SearchNumberField extends SearchField {
    constructor(params: SearchFieldParams) {
        super(RuleType.NumberField, params);
    }

    setOption(option: NumberOption) {
        if (this.option !== NumberOption.Between && option === NumberOption.Between) {
            this.value = [(this.value as number), undefined];
        } else if (this.option === NumberOption.Between && option !== NumberOption.Between) {
            this.value = this.value?.[0];
        }
        super.setOption(option);
    }

    setFirstValue(value: number | null | undefined) {
        this.value = [value ? value : undefined, this.value?.[1]];
    }

    setSecondValue(value: number | null | undefined) {
        this.value = [this.value?.[0], value ? value : undefined];
    }
}

export class SearchTreeField extends SearchField {
    constructor(params: SearchFieldParams) {
        super(RuleType.TreeField, params);
    }
}