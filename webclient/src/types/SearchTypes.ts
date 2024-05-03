export enum RuleType {
    Group = 'Group',
    Field = 'Field',
    TextField = 'TextField',
    NumberField = 'NumberField',
    EnumField = 'EnumField',
    TreeField = 'TreeField',
    RegexField = 'RegexField',
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

export enum EnumOption {
    Is = "Is",
    IsNot = "IsNot",
    IsNull = "IsNull",
    IsNotNull = "IsNotNull",
};

export enum TreeOption {
    IsIn = "IsIn",
    IsNotIn = "IsNotIn",
    IsNull = "IsNull",
    IsNotNull = "IsNotNull",
};

export enum RegexOption {
    Match = "Match",
    NotMatch = "NotMatch",
};