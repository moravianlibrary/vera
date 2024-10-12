import React, { useEffect, useState } from "react";
import { EsQuery } from "../../adapters/ApiTasks";
import {
    DataTableSelectionMultipleChangeEvent,
    DataTableValueArray,
} from "primereact/datatable";
import { EsItemsPaginationProps } from "./EsPaginationInjector";

interface EsItemsSelectionProps<T extends { id: string }>
    extends EsItemsPaginationProps<T> {
    numSelected: number;
    currentPageSelected: T[];
    handleDataTableSelectionChange: (
        event: DataTableSelectionMultipleChangeEvent<DataTableValueArray>
    ) => void;
    areAllSelected: boolean;
    setAreAllSelected: (value: boolean) => void;
    cancelSelection: () => void;
    selectedQuery: EsQuery;
}

const withEsSelection = <T extends { id: string }>(
    WrappedComponent: React.ComponentType<EsItemsSelectionProps<T>>
) => {
    return (props: EsItemsSelectionProps<T> & Record<string, any>) => {
        const { items, queryParams, numFound } = props;

        const [numSelected, setNumSelected] = useState<number>(0);
        const [currentPageSelected, setCurrentPageSelected] = useState<any[]>(
            []
        );
        const [areAllSelected, setAreAllSelected] = useState<boolean>(false);
        const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
        const [selectedQuery, setSelectedQuery] = useState<any>({});

        const handleDataTableSelectionChange = (
            event: DataTableSelectionMultipleChangeEvent<DataTableValueArray>
        ) => {
            const currentSelectedIds = new Set(
                event.value.map((item) => item.id)
            );
            const currentPageIds = new Set(items.map((item) => item.id));

            setSelectedIds((prevSelectedIds) => {
                const updatedSelectedIds = new Set(prevSelectedIds);
                currentPageIds.forEach((id) => {
                    if (!currentSelectedIds.has(id)) {
                        updatedSelectedIds.delete(id);
                    }
                });
                currentSelectedIds.forEach((id) => updatedSelectedIds.add(id));

                setNumSelected(updatedSelectedIds.size);

                setAreAllSelected(updatedSelectedIds.size === numFound);

                setSelectedQuery({
                    id: Array.from(updatedSelectedIds).join(","),
                });

                return updatedSelectedIds;
            });
        };

        const onSetAreAllSelected = (value: boolean) => {
            setAreAllSelected(value);
            setNumSelected(value ? numFound : selectedIds.size);
            setSelectedQuery(queryParams);
        };

        const cancelSelection = () => {
            setSelectedIds(new Set());
            setNumSelected(0);
            setAreAllSelected(false);
            setSelectedQuery({});
        };

        useEffect(() => {
            cancelSelection();
        }, [queryParams]);

        return (
            <WrappedComponent
                {...(props as any)}
                numSelected={numSelected}
                currentPageSelected={currentPageSelected}
                handleDataTableSelectionChange={handleDataTableSelectionChange}
                areAllSelected={areAllSelected}
                setAreAllSelected={onSetAreAllSelected}
                cancelSelection={cancelSelection}
                selectedQuery={selectedQuery}
            />
        );
    };
};

export default withEsSelection;
export type { EsItemsSelectionProps };
