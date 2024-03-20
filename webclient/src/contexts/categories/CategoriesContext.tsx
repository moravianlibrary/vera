import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiCategories, { Category } from "../../adapters/ApiCategories";
import ApiExtractions from "../../adapters/ApiExtractions";

interface CategoriesContextProps {
    categories: Category[] | undefined;
    extractionId: number | null;
    extractionMarked: boolean;
    setExtractionId: (extractionId: number) => void;
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
    const [extractionMarked, setExtractionMarked] = useState<boolean>(false);

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
        ApiExtractions.getExtraction(extractionId!).then((response) => {
            setExtractionMarked(response.data.marked);
        });
        ApiCategories.getExtractionCategories(extractionId!)
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

    const contextValue: CategoriesContextProps = {
        categories,
        extractionId,
        extractionMarked,
        setExtractionId,
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
