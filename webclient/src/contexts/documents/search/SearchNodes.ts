import { EnumOption, GroupOption, NumberOption, RegexOption, RuleType, TextOption, TreeOption } from "../../../types/SearchTypes";
import { DocumentField } from "../../../types/DocumentSearchField";

type SubRule = SearchGroup | SearchField;

export interface SearchGroupParams {
    level: number;
    option: GroupOption;
    sub_rules: SubRule[];
}

type FieldOption = TextOption | NumberOption | EnumOption | TreeOption | RegexOption | undefined;
type Value = string | number | [number | undefined, number | undefined] | number[] | null | undefined;

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
    [RuleType.EnumField]: EnumOption.Is,
    [RuleType.TreeField]: TreeOption.IsIn,
    [RuleType.RegexField]: RegexOption.Match,
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

export class SearchGroup extends SearchNode implements SearchGroupParams {
    option: GroupOption;
    sub_rules: SubRule[];

    constructor(params: SearchGroupParams) {
        super(RuleType.Group, params.level)
        this.option = params.option;
        this.sub_rules = params.sub_rules
            ? params.sub_rules.map(subRule => {
                switch (subRule.type) {
                    case RuleType.Group: return new SearchGroup(subRule as SearchGroupParams);
                    case RuleType.TextField: return new SearchTextField(subRule as SearchFieldParams);
                    case RuleType.NumberField: return new SearchNumberField(subRule as SearchFieldParams);
                    case RuleType.EnumField: return new SearchEnumField(subRule as SearchFieldParams);
                    case RuleType.TreeField: return new SearchTreeField(subRule as SearchFieldParams);
                    case RuleType.RegexField: return new SearchLocationField(subRule as SearchFieldParams);
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
        return this.sub_rules?.length === 0;
    }

    createSubGroup() {
        const newGroup = new SearchGroup({ level: this.level + 1, option: DEFAULT_GROUP_OPTION, sub_rules: [] });
        this.sub_rules = [...this.sub_rules, newGroup];
    }

    createSubField() {
        const newField = SearchField.create(RuleType.Field, this.level + 1);
        this.sub_rules = [...this.sub_rules, newField];
    }

    updateSubRule(subRule: SubRule, index: number) {   
        const updatedSubRules = [
            ...this.sub_rules.slice(0, index),
            subRule,
            ...this.sub_rules.slice(index + 1)
        ];
        console.log(this.sub_rules);
        console.log(updatedSubRules);
        this.sub_rules = updatedSubRules;
    }

    deleteSubRule(index) {
        const updatedSubRules = [
            ...this.sub_rules.slice(0, index),
            ...this.sub_rules.slice(index + 1)
        ];
        this.sub_rules = updatedSubRules;
    }

    filterOutEmptySubRules() {
        this.sub_rules.filter(subRule => subRule.type === RuleType.Group)
                .forEach(subGroup => (subGroup as SearchGroup).filterOutEmptySubRules());
        this.sub_rules = this.sub_rules.filter(subRule =>
            subRule.type !== RuleType.Field 
            && !(subRule.type === RuleType.Group && (subRule as SearchGroup).isEmpty())
        );
    }

    static createCategoryIdSearch(categoryIds: number[]) {
        return new SearchGroup({ level: 0, option: DEFAULT_GROUP_OPTION, sub_rules: [SearchField.createCategoryIdField(categoryIds)] });
    }

    static createEmpty() {
        return new SearchGroup({ level: 0, option: DEFAULT_GROUP_OPTION, sub_rules: [] });
    }

    static init() {
        const saved = localStorage.getItem('advanced_search');
        return saved
                ? new SearchGroup(JSON.parse(saved) as SearchGroupParams)
                : SearchGroup.createEmpty();
    }
}

export class SearchField extends SearchNode implements SearchFieldParams {
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

    static createCategoryIdField(categoryIds: number[]) {
        return SearchField.create(RuleType.TreeField, 0, DocumentField.Category, TreeOption.IsIn, categoryIds);
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

export class SearchEnumField extends SearchField {
    constructor(params: SearchFieldParams) {
        super(RuleType.EnumField, params);
        console.log(params);
    }
}

export class SearchTreeField extends SearchField {
    constructor(params: SearchFieldParams) {
        super(RuleType.TreeField, params);
    }
}


export class SearchLocationField extends SearchField {
    constructor(params: SearchFieldParams) {
        super(RuleType.RegexField, params);
    }
}

