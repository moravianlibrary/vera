const RuleType = {
    GROUP: 'GROUP',
    TEXT_FIELD: 'TEXT_FIELD',
    NUMBER_FIELD: 'NUMBER_FIELD',
    ENUM_FIELD: 'ENUM_FIELD',
}

const GroupOptions = {
    MATCH_ALL: 'MATCH_ALL',
    MATCH_ANY: 'MATCH_ANY'
}

const TextOptions = {
    EQUALS: "EQUALS",
    STARTS_WITH: "STARTS_WITH",
    ENDS_WITH: "ENDS_WITH",
    CONTAINS: "CONTAINS",
    NOT_CONTAINS: "NOT_CONTAINS",
    NOT_EQUALS: "NOT_EQUALS",
    NULL: "NULL"
};

const NumberOptions = {
    EQUAL_TO: "EQUAL_TO",
    NOT_EQUAL_TO: "NOT_EQUAL_TO",
    LESS_THAN: "LESS_THAN",
    MORE_THAN: "MORE_THAN",
    BETWEEN: "BETWEEN",
    NULL: "NULL"
};

const EnumOptions = {
    IS_IN: "IS_IN",
    IS_NOT_IN: "IS_NOT_IN"
};

export class SearchNode {
    constructor(type) {
        this.type = type;
    }

    toJson() {
        return { type: this.type };
    }
};

export class SearchGroup extends SearchNode {
    constructor(option) {
        super(RuleType.GROUP)
        this.option = option;
    }

    static fromJson(json) {
        return new this(json.option);
    }

    toJson() {
        return {
            ...super.toJson(),
            option: this.option,
        };
    }

    setOption(option) {
        this.option = option;
    }

    static getDefault() {
        return new SearchGroup(GroupOptions.MATCH_ALL);
    }
}

export class SearchField extends SearchNode {
    constructor(type, name, option) {
        super(type);
        this.name = name;
        this.option = option;
    }

    static fromJson(json) {
        const field = super.fromJson(json);
        field.name = json.name;
        field.option = json.option;
        return field;
    }

    toJson() {
        return {
            ...super.toJson(),
            name: this.name,
            option: this.option,
        };
    }
}

export class SearchTextField extends SearchField {
    constructor(name) {
        super(RuleType.TEXT_FIELD, name, TextOptions.EQUALS);
        this.value = "";
    }

    static fromJson(json) {
        const field = super.fromJson(json);
        field.value = json.value;
        return field;
    }

    toJson() {
        return {
            ...super.toJson(),
            value: this.value
        };
    }

    setOption(option) {
        super.option = option;
    }

    setValue(value) {
        this.value = value;
    }
}

export class SearchNumberField extends SearchField {
    constructor(name) {
        super(RuleType.NUMBER_FIELD, name, NumberOptions.EQUAL_TO);
        this.value = super.option === NumberOptions.BETWEEN ? ["", ""] : "";
    }

    static fromJson(json) {
        const field = super.fromJson(json);
        field.value = [...json.value];
        return field;
    }

    toJson() {
        return {
            ...super.toJson(),
            value: this.value
        };
    }

    setOption(option) {
        this.value = option === NumberOptions.BETWEEN ? ["", ""] : "";
        super.option = option;
    }

    setValue(value) {
        this.value = value;
    }

    setFirstValue(value) {
        this.value = [value, this.value[1]];
    }

    setSecondValue(value) {
        this.value = [this.value[0], value];
    }
}

export class SearchEnumField extends SearchField {
    constructor(name) {
        super(RuleType.ENUM_FIELD, name, EnumOptions.IS_IN);
        this.value = null;
    }

    static fromJson(json) {
        const field = super.fromJson(json);
        field.value = json.value;
        return field;
    }

    toJson() {
        return {
            ...super.toJson(),
            value: this.value
        };
    }

    setOption(option) {
        super.option = option;
    }

    setValue(value) {
        this.value = value;
    }
}