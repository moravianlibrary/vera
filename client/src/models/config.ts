import type { ReactElement } from "react";

export interface TableColumnConfig {
    key: string;
    fields: string[];
    label: string;
    render?: (data: any) => ReactElement;
    visibleByDefault?: boolean;
    alwaysShow?: boolean;
}

export interface TableColumnState {
    visible: boolean;
    order: number;
}

export interface FilterOptionConfig {
    key: string;
}

export type SelectionType = Set<string> | "page" | "all";
