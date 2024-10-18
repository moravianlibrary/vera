import React, { createContext, useContext, ReactNode } from "react";
import ApiRoles, { Role } from "../adapters/ApiRoles";
import useItemsPagination, {
    ItemsPaginationProps,
} from "./base/PaginationInjector";
import useItemActions, { ItemActionsProps } from "./base/ItemActionsInjector";
import useDataTableEdit, {
    DataTableEditProps,
} from "./base/DataTableEditInjector";

interface RolesContextProps
    extends Omit<ItemsPaginationProps<Role>, "items">,
        ItemActionsProps<Role>,
        DataTableEditProps<Role> {}

const RolesContext = createContext<RolesContextProps | undefined>(undefined);

interface RolesProviderProps {
    children: ReactNode;
}

export const RolesProvider: React.FC<RolesProviderProps> = ({ children }) => {
    const api = new ApiRoles();
    const {
        items: currItems,
        refresh,
        ...restOfPaginationProps
    } = useItemsPagination(api, "roles");
    const { createItem, updateItem, ...restOfItemActionsProps } =
        useItemActions(api, refresh, "roles", "roles");
    const dataTableEditProps = useDataTableEdit(
        currItems,
        { id: null, name: "", actions: [] },
        createItem,
        updateItem
    );

    const contextValue: RolesContextProps = {
        refresh,
        ...restOfPaginationProps,
        createItem,
        updateItem,
        ...restOfItemActionsProps,
        ...dataTableEditProps,
    };

    return (
        <RolesContext.Provider value={contextValue}>
            {children}
        </RolesContext.Provider>
    );
};

export const useRoles = (): RolesContextProps => {
    const context = useContext(RolesContext);

    if (!context) {
        throw new Error("useRoles must be used within a RolesProvider");
    }

    return context;
};
