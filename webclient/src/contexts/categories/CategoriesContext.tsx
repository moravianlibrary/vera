import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiCategories, { Category } from "../../adapters/ApiCategories";
import ApiExtractions from "../../adapters/ApiGeneratedExtractions";

interface CategoriesContextProps {
    categories: Category[] | undefined;
    extractionId: number | null;
    setExtractionId: (extractionId: number) => void;
    digitizationListId: number | null;
    setDigitizationListId: (extractionId: number) => void;
    refreshCategories: () => void;
}

const CategoriesContext = createContext<CategoriesContextProps | undefined>(
    undefined
);

interface CategoriesProviderProps {
    children: ReactNode;
}

export const CategoriesProvider: React.FC<CategoriesProviderProps> = ({
    children,
}) => {
    const [categories, setCategories] = useState<Category[] | undefined>(
        undefined
    );
    const [extractionId, setExtractionId] = useState<number | null>(null);
    const [digitizationListId, setDigitizationListId] = useState<number | null>(
        null
    );

    const loadCategories = async () => {
        console.log(`Fetching categories from server.`);
        ApiCategories.getCategories()
            .then((response) => {
                const transformedData: Category[] = response.data.map(
                    (category) => {
                        return Object.assign({}, category) as Category;
                    }
                );
                setCategories(transformedData);
            })
            .catch((error) => {
                console.error(`Could not receive categories: ${error}`);
            });
    };

    const loadExtractionCategories = async () => {
        console.log(`Fetching extraction categories from server.`);
        ApiCategories.getGeneratedExtractionCategories(extractionId!)
            .then((response) => {
                const transformedData: Category[] = response.data.map(
                    (category) => {
                        return Object.assign({}, category) as Category;
                    }
                );
                setCategories(transformedData!);
            })
            .catch((error) => {
                console.error(`Could not receive categories: ${error}`);
            });
    };

    const loadDigitizationListCategories = async () => {
        console.log(`Fetching digitization list categories from server.`);
        ApiCategories.getDigitizationExtractionCategories(digitizationListId!)
            .then((response) => {
                const transformedData: Category[] = response.data.map(
                    (category) => {
                        return Object.assign({}, category) as Category;
                    }
                );
                setCategories(transformedData!);
            })
            .catch((error) => {
                console.error(`Could not receive categories: ${error}`);
            });
    };

    const refreshCategories = () => {
        setCategories(categories?.map((category) => category) as Category[]);
    };

    useEffect(() => {
        if (!categories) {
            loadCategories();
        }
    }, [categories]);

    useEffect(() => {
        if (extractionId) {
            loadExtractionCategories();
        } else {
            loadCategories();
        }
    }, [extractionId]);

    useEffect(() => {
        if (digitizationListId) {
            loadDigitizationListCategories();
        } else {
            loadCategories();
        }
    }, [digitizationListId]);

    const contextValue: CategoriesContextProps = {
        categories,
        extractionId,
        setExtractionId,
        digitizationListId,
        setDigitizationListId,
        refreshCategories,
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
        throw new Error(
            "useCategories must be used within a CategoriesProvider"
        );
    }

    return context;
};
