export interface ActionItemConfig {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
}

export interface ActionSectionConfig {
    label: string;
    icon?: React.ReactNode;
    actions: ActionConfig[];
}

export type ActionConfig = ActionItemConfig | ActionSectionConfig;

export type DynamicI18n = (values?: Record<string, string | number>) => string;
export type I18n = string;
export type AnyI18n = I18n | DynamicI18n;
