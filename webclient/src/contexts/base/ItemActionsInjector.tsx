import { useCallback } from "react";
import { ApiBase } from "../../adapters/ApiBase";
import { useTranslation } from "react-i18next";
import { useNotification } from "../NotificationContext";

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
    const { showSuccess, showFailure } = useNotification();

    const createItem = useCallback(
        (item: Partial<T>) => {
            api.create(item).then((response) => {
                refreshResults();
            });
        },
        [refreshResults, api]
    );

    const updateItem = useCallback(
        (itemId: number, item: Partial<T>) => {
            api.update(itemId, item).then((response) => {
                refreshResults();
            });
        },
        [refreshResults, api]
    );

    const deleteItem = useCallback(
        (itemId: number) => {
            api.delete(itemId).then((response) => {
                refreshResults();
            });
        },
        [refreshResults, api]
    );

    return {
        createItem,
        updateItem,
        deleteItem,
    };
};

export default useItemActions;
export type { ItemActionsProps };
