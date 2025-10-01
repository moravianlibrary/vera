import type { EsSortBy } from "../api/requests/es";

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

export interface EsSortOption {
    key: string;
    label: UiText;
    value: EsSortBy;
}

// ------- ______ Not used
export interface SettingsSectionItemConfig {
    key: string;
    label: UiText;
    icon?: React.ReactNode;
}

export interface SettingsSectionConfig {
    key: string;
    label: UiText;
    icon?: React.ReactNode;
    items: SettingsSectionItemConfig[];
    selectionType?: "single" | "multiple";
    reorderable?: boolean;
    onSelect?: (item: SettingsSectionItemConfig) => void;
    onReorder?: (sourceIndex: number, destinationIndex: number) => void;
}

export interface SettingsSectionState {
    selectedItems: Set<string>;
    itemsOrder: Record<string, number>;
}
// ------- ^^^^

export type DynamicUiText = (
    values?: Record<string, string | number>
) => string;
export type StaticUiText = string;
export type UiText = StaticUiText | DynamicUiText;
