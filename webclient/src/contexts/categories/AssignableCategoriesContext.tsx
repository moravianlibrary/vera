import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiCategories, { AssignableCategory } from "../../adapters/ApiCategories";

interface AssignableCategoriesContextProps {
    categories: AssignableCategory[];
}

const AssignableCategoriesContext = createContext<AssignableCategoriesContextProps | undefined>(undefined);

interface AssignableCategoriesProviderProps {
    children: ReactNode;
}

export const AssignableCategoriesProvider: React.FC<AssignableCategoriesProviderProps> = ({ children }) => {
    const [categories, setCategories] = useState<AssignableCategory[]>([]);

    const loadCategories = async () => {
        ApiCategories.getAssignableCategories()
        .then(response => {
            const transformedData: AssignableCategory[] = response.data.map(assignableCategory => {
                return Object.assign({}, assignableCategory) as AssignableCategory;
            });
            console.log(transformedData);
            setCategories(transformedData);
        }).catch(error => {
            console.error(`Could not receive assignable categories: ${error}`);
        });
    };

    useEffect(() => {
        console.log(`Fetching assignable categories from server.`);
        loadCategories();
    }, []);

    const contextValue: AssignableCategoriesContextProps = {
        categories
    };

    return (
        <AssignableCategoriesContext.Provider value={contextValue}>
            {children}
        </AssignableCategoriesContext.Provider>
    );
};

export const useAssignableCategories = (): AssignableCategoriesContextProps => {
    const context = useContext(AssignableCategoriesContext);

    if (!context) {
        throw new Error('useAssignableCategories must be used within a AssignableCategoriesProvider');
    }

    return context;
};
