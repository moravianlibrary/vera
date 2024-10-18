import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
} from "react";
import { ItemsPaginationProps } from "./base/PaginationInjector";
import ApiPeriodicTasks, { PeriodicTask } from "../adapters/ApiPeriodicTasks";
import useItemsPagination from "./base/PaginationInjector";
import useItemActions, { ItemActionsProps } from "./base/ItemActionsInjector";

interface PeriodicTasksContextProps
    extends ItemsPaginationProps<PeriodicTask>,
        ItemActionsProps<PeriodicTask> {
    planPeriodicTask: (periodicTask: Partial<PeriodicTask>) => void;
}

const PeriodicTasksContext = createContext<
    PeriodicTasksContextProps | undefined
>(undefined);

interface PeriodicTasksProviderProps {
    children: ReactNode;
}

const PeriodicTasksProvider: React.FC<PeriodicTasksProviderProps> = ({
    children,
}) => {
    const api = new ApiPeriodicTasks();
    const { refresh, ...restOfPaginationProps } = useItemsPagination(
        api,
        "periodicTasks"
    );
    const itemActionsProps = useItemActions(
        api,
        refresh,
        "periodicTasks",
        "periodic-tasks"
    );

    const planPeriodicTask = useCallback(
        (periodickTask: Partial<PeriodicTask>) => {
            api.plan(periodickTask).then((response) => {
                refresh();
            });
        },
        [refresh]
    );

    const contextValue: PeriodicTasksContextProps = {
        refresh,
        ...restOfPaginationProps,
        planPeriodicTask,
        ...itemActionsProps,
    };

    return (
        <PeriodicTasksContext.Provider value={contextValue}>
            {children}
        </PeriodicTasksContext.Provider>
    );
};

const usePeriodicTasks = (): PeriodicTasksContextProps => {
    const context = useContext(PeriodicTasksContext);

    if (!context) {
        throw new Error(
            "usePeriodicTasks must be used within a PeriodicTasksProvider"
        );
    }

    return context;
};

export { PeriodicTasksProvider, usePeriodicTasks };
