import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiDepartments, { Department } from "../adapters/ApiDepartments";
import ApiUsers from "../adapters/ApiUsers";
import useItemsPagination, {
    ItemsPaginationProps,
} from "./base/PaginationInjector";
import useItemActions, { ItemActionsProps } from "./base/ItemActionsInjector";
import useDataTableEdit, {
    DataTableEditProps,
} from "./base/DataTableEditInjector";

interface DepartmentsContextProps
    extends Omit<ItemsPaginationProps<Department>, "items">,
        ItemActionsProps<Department>,
        DataTableEditProps<Department> {
    usernames: string[];
}

const DepartmentsContext = createContext<DepartmentsContextProps | undefined>(
    undefined
);

interface DepartmentsProviderProps {
    children: ReactNode;
}

export const DepartmentsProvider: React.FC<DepartmentsProviderProps> = ({
    children,
}) => {
    const api = new ApiDepartments();
    const apiUsers = new ApiUsers();

    const {
        items: currItems,
        refresh,
        ...restOfPaginationProps
    } = useItemsPagination(api, "departments");
    const { createItem, updateItem, ...restOfItemActionsProps } =
        useItemActions(api, refresh, "departments", "departments");
    const dataTableEditProps = useDataTableEdit(
        currItems,
        { id: null, name: "", abbreviation: "", usernames: [] },
        createItem,
        updateItem
    );

    const [usernames, setUsernames] = useState<string[]>([]);

    const loadUsers = async () => {
        apiUsers
            .getPage(1, 50)
            .then((response) =>
                setUsernames(
                    response.data.items.map((user) => user.username) || []
                )
            )
            .catch((error) => {
                console.error(`Could not receive user names: ${error}`);
            });
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const contextValue: DepartmentsContextProps = {
        refresh,
        ...restOfPaginationProps,
        createItem,
        updateItem,
        ...restOfItemActionsProps,
        ...dataTableEditProps,
        usernames,
    };

    return (
        <DepartmentsContext.Provider value={contextValue}>
            {children}
        </DepartmentsContext.Provider>
    );
};

export const useDepartments = (): DepartmentsContextProps => {
    const context = useContext(DepartmentsContext);

    if (!context) {
        throw new Error(
            "useDepartments must be used within a DepartmentsProvider"
        );
    }

    return context;
};
