import type { ReactElement } from "react";

export interface TableColumnConfig<T> {
    key: string;
    render: (data: Partial<T>) => ReactElement;
    visibleByDefault?: boolean;
    alwaysShow?: boolean;
}

export interface FilterOptionConfig {
    key: string;
}
