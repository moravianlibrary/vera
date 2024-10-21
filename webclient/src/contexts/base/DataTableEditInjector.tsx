import { useState, useEffect, useCallback } from "react";
import { DataTableRowEditEvent } from "primereact/datatable";

type ItemWithNullableId<T> = Omit<T, "id"> & {
    id: number | null;
};

interface DataTableEditProps<T extends { id: number }> {
    items: ItemWithNullableId<T>[];
    editingItems: ItemWithNullableId<T>[];
    addItem: () => void;
    editItem: (itemId: number) => void;
    saveChanges: (itemId: number | null, item: ItemWithNullableId<T>) => void;
    discardChanges: (itemId: number | null) => void;
    onRowEditEvent: (event: DataTableRowEditEvent) => void;
}

const useDataTableEdit = <T extends { id: number }>(
    currItems: T[],
    emptyItem: ItemWithNullableId<T>,
    createItem: (item: Partial<T>) => void,
    updateItem: (itemId: number, item: Partial<T>) => void
) => {
    const [items, setItems] = useState<ItemWithNullableId<T>[]>([]);
    const [editingItems, setEditingItems] = useState<ItemWithNullableId<T>[]>(
        []
    );

    const addItem = useCallback(() => {
        setItems((prev) => [emptyItem, ...prev]);
        setEditingItems((prev) => [...prev, emptyItem]);
    }, [setEditingItems, emptyItem]);

    const editItem = useCallback(
        (itemId: number) => {
            if (editingItems.some((i) => i.id === itemId)) return;
            const item = items.find((i) => i.id === itemId);
            if (!item) return;
            setEditingItems((prev) => [...prev, item]);
        },
        [editingItems, items, setEditingItems]
    );

    const saveChanges = useCallback(
        (itemId: number | null, item: T) => {
            if (!itemId) {
                createItem(item);
            } else {
                updateItem(itemId, item);
            }
            setEditingItems((prev) => prev.filter((i) => i.id !== itemId));
        },
        [setEditingItems, createItem, updateItem]
    );

    const discardChanges = useCallback(
        (itemId: number | null) => {
            setEditingItems((prev) => prev.filter((i) => i.id !== itemId));
        },
        [setEditingItems]
    );

    const onRowEditEvent = useCallback(
        (event: DataTableRowEditEvent) => {
            const item = items[event.index];
            if (editingItems.includes(item)) {
                discardChanges(item.id);
            } else {
                editItem(item.id);
            }
        },
        [editingItems, items, editItem, discardChanges]
    );

    useEffect(() => {
        setItems(currItems);
        setEditingItems([]);
    }, [currItems]);

    return {
        items,
        editingItems,
        addItem,
        editItem,
        saveChanges,
        discardChanges,
        onRowEditEvent,
    };
};

export default useDataTableEdit;
export type { DataTableEditProps };
