import { useState, useEffect, useCallback } from "react";
import { ApiBase } from "../../adapters/ApiBase";
import { useTranslation } from "react-i18next";

interface ItemActionsProps<T> {
    createItem: (item: Partial<T>) => void;
    updateItem: (itemId: number, item: Partial<T>) => void;
    deleteItem: (itemId: number) => void;
}

const useItemActions = <T extends Object>(
    api: ApiBase<T>,
    refreshResults: () => void,
    itemName: string,
    translationNs: string
) => {
    const { t } = useTranslation(translationNs);

    const createItem = useCallback(
        (item: Partial<T>) => {
            api.create(item).then((response) => {
                refreshResults();
            });
        },
        [refreshResults]
    );

    const updateItem = useCallback(
        (itemId: number, item: Partial<T>) => {
            api.update(itemId, item).then((response) => {
                refreshResults();
            });
        },
        [refreshResults]
    );

    const deleteItem = useCallback(
        (itemId: number) => {
            api.delete(itemId).then((response) => {
                refreshResults();
            });
        },
        [refreshResults]
    );

    return {
        createItem,
        updateItem,
        deleteItem,
    };
};

export default useItemActions;
export type { ItemActionsProps };
