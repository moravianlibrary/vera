import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiCategories, { Category } from "../../adapters/ApiCategories";

interface CategoriesContextProps {
    categories: Category[] | undefined;
}

const CategoriesContext = createContext<CategoriesContextProps | undefined>(undefined);

interface CategoriesProviderProps {
    children: ReactNode;
}

export const CategoriesProvider: React.FC<CategoriesProviderProps> = ({ children }) => {
    const [categories, setCategories] = useState<Category[] | undefined>(undefined);

    const loadCategories = async () => {
        ApiCategories.getCategories()
        .then(response => {
            const transformedData: Category[] = response.data.map(category => {
                return Object.assign({}, category) as Category;
            });
            setCategories(transformedData);
        }).catch(error => {
            console.error(`Could not receive categories: ${error}`);
        });
    };

    useEffect(() => {
        console.log(`Fetching categories from server.`);
        loadCategories();
    }, []);

    const contextValue: CategoriesContextProps = {
        categories
    };

    return (
        <CategoriesContext.Provider value={contextValue}>
            {children}
        </CategoriesContext.Provider>
    );
};

export const useCategories = (): CategoriesContextProps => {
    const context = useContext(CategoriesContext);

    if (!context) {
        throw new Error('useCategories must be used within a CategoriesProvider');
    }

    return context;
};
