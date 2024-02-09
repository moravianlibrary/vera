import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiCategories, { Category } from "../../adapters/ApiCategories";
import ApiExtractions from "../../adapters/ApiExtractions";

interface CategoriesContextProps {
    categories: Category[] | undefined;
    extractionId: number | null;
}

const CategoriesContext = createContext<CategoriesContextProps | undefined>(undefined);

interface CategoriesProviderProps {
    children: ReactNode;
}

export const CategoriesProvider: React.FC<CategoriesProviderProps> = ({ children }) => {
    const [categories, setCategories] = useState<Category[] | undefined>(undefined);
    const [extractionId, setExtractionId] = useState<number | null>(3);

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

    const loadExtractionCategories = async () => {
        ApiCategories.getExtractionCategories(extractionId!)
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
        if (extractionId === null) {
            loadCategories();
        } else {
            loadExtractionCategories();
        }
    }, []);

    const contextValue: CategoriesContextProps = {
        categories,
        extractionId,
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
