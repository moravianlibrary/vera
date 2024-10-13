import { useEffect, useState } from "react";
import { EsQuery } from "../../adapters/ApiTasks";
import {
    DataTableSelectionMultipleChangeEvent,
    DataTableValueArray,
} from "primereact/datatable";

interface EsItemsSelectionProps<T extends { id: string }> {
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

const useEsSelection = <T extends { id: string }>(
    items: T[],
    numFound: number,
    queryParams: EsQuery
) => {
    const [numSelected, setNumSelected] = useState<number>(0);
    const [currentPageSelected, setCurrentPageSelected] = useState<any[]>([]);
    const [areAllSelected, setAreAllSelected] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectedQuery, setSelectedQuery] = useState<any>({});

    const handleDataTableSelectionChange = (
        event: DataTableSelectionMultipleChangeEvent<DataTableValueArray>
    ) => {
        const currentSelectedIds = new Set(event.value.map((item) => item.id));
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
        if (areAllSelected) {
            setCurrentPageSelected(items);
        } else {
            setCurrentPageSelected(
                items.filter((item) => selectedIds.has(item.id))
            );
        }
    }, [items, selectedIds, areAllSelected]);

    useEffect(() => {
        cancelSelection();
    }, [queryParams]);

    return {
        numSelected,
        currentPageSelected,
        handleDataTableSelectionChange,
        areAllSelected,
        setAreAllSelected: onSetAreAllSelected,
        cancelSelection,
        selectedQuery,
    };
};

export default useEsSelection;
export type { EsItemsSelectionProps };
