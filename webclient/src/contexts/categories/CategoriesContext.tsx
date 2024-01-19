import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiCategories, { AssignableCategory, Category } from "../../adapters/ApiCategories";

interface AssignableCategoriesContextProps {
    fetchCategories: () => Promise<Category[]>;
}

const AssignableCategoriesContext = createContext<AssignableCategoriesContextProps | undefined>(undefined);

interface AssignableCategoriesProviderProps {
    children: ReactNode;
}

export const AssignableCategoriesProvider: React.FC<AssignableCategoriesProviderProps> = ({ children }) => {
    const [categories, setCategories] = useState<Category[]>();

    const loadCategories = async () => {
        ApiCategories.getAssignableCategories()
        .then(response => {
            const transformedData: Category[] = response.data.map(assignableCategory => {
                return Object.assign({}, assignableCategory) as Category;
            });
            console.log(transformedData);
            setCategories(transformedData);
        }).catch(error => {
            console.error(`Could not receive assignable categories: ${error}`);
        });
    };

    const fetchCategories = async () => {
        console.log(`fetch categories from server ${!categories}`)
        if (!categories) {
            await loadCategories();
        }
        return categories ? categories : [];
    }

    const contextValue: AssignableCategoriesContextProps = {
        fetchCategories
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
        throw new Error('useCategories must be used within a CategoriesProvider');
    }

    return context;
};
