import React, { createContext, ReactNode, useContext } from "react";
import withPagination, {
    ItemsPaginationProps,
} from "./base/PaginationInjector";
import ApiPeriodicTasks, { PeriodicTask } from "../adapters/ApiPeriodicTasks";

interface PeriodicTasksContextProps
    extends ItemsPaginationProps<PeriodicTask> {}

const PeriodicTasksContext = createContext<
    PeriodicTasksContextProps | undefined
>(undefined);

interface PeriodicTasksProviderProps {
    children: ReactNode;
}

const PeriodicTasksProvider: React.FC<PeriodicTasksProviderProps> =
    withPagination(
        ({ children, ...props }) => {
            const contextValue: PeriodicTasksContextProps = {
                ...props,
            };

            return (
                <PeriodicTasksContext.Provider value={contextValue}>
                    {children}
                </PeriodicTasksContext.Provider>
            );
        },
        new ApiPeriodicTasks(),
        "periodic_tasks"
    );

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
