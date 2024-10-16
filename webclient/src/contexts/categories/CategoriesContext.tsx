import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiCategories, { Category } from "../../adapters/ApiCategories";
import { useIntentions } from "./IntentionsContext";
import { AxiosResponse } from "axios";
import { Department } from "../../adapters/ApiDepartments";
import { useAccess } from "../AccessContext";
import { ActionType } from "../../types/ActionType";

interface CategoriesContextProps {
    categories: Category[] | undefined;
    getAssignableCategoriesTrees: () => Category[];
    department: Department | null;
    setDepartment: (department: Department | null) => void;
    extractionId: number | null;
    setExtractionId: (extractionId: number) => void;
    digitizationListId: number | null;
    setDigitizationListId: (extractionId: number) => void;
    refreshCategories: (categories?: Category[]) => void;
    findCategoryById: (id: number) => Category | null;
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
    const { currentUser, hasPermission } = useAccess();
    const { activeIntention } = useIntentions();
    const [categories, setCategories] = useState<Category[] | undefined>(
        undefined
    );
    const [department, setDepartment] = useState<Department | null>(null);
    const [extractionId, setExtractionId] = useState<number | null>(null);
    const [digitizationListId, setDigitizationListId] = useState<number | null>(
        null
    );

    const fetchCategories = async (
        getCategoriesFunction: () => Promise<AxiosResponse<Category[], any>>
    ) => {
        try {
            const response = await getCategoriesFunction();
            const transformedData: Category[] = response.data.map(
                (category) => {
                    return Object.assign({}, category) as Category;
                }
            );
            setCategories(transformedData);
        } catch (error) {
            console.error(`Could not receive categories: ${error}`);
        }
    };

    const loadCategories = async () => {
        const departmentId = !hasPermission(ActionType.ReadCategoriesAll)
            ? currentUser?.department_id
            : department?.id;
        if (
            !hasPermission(ActionType.ReadCategoriesAll) &&
            departmentId === null
        ) {
            return;
        }

        if (!activeIntention && !extractionId && !digitizationListId) {
            console.debug(`Fetching categories from server.`);
            await fetchCategories(() =>
                ApiCategories.getCategories(departmentId)
            );
        } else if (activeIntention && !extractionId && !digitizationListId) {
            console.debug(`Fetching intention categories from server.`);
            await fetchCategories(() =>
                ApiCategories.getCategoriesByIntention(
                    activeIntention.id,
                    departmentId
                )
            );
        } else if (activeIntention && extractionId && !digitizationListId) {
            console.debug(`Fetching extraction categories from server.`);
            await fetchCategories(() =>
                ApiCategories.getCategoriesForExtraction(
                    activeIntention.id,
                    extractionId,
                    departmentId
                )
            );
        } else if (activeIntention && !extractionId && digitizationListId) {
            console.debug(`Fetching digitization list categories from server.`);
            await fetchCategories(() =>
                ApiCategories.getCategoriesForDigitization(
                    activeIntention.id,
                    [digitizationListId],
                    departmentId
                )
            );
        } else {
            console.error(
                "Could not receive categories. Invalid state: " +
                    `${activeIntention}, ${extractionId}, ${digitizationListId}`
            );
        }
    };

    const getAssignableCategoriesTrees = () => {
        const buildAssignableCategoriesTrees = (categories: Category[]) => {
            return categories
                .map((category) => {
                    if (category.assignable) {
                        return category;
                    }
                    const sub_categories = buildAssignableCategoriesTrees(
                        category.sub_categories
                    );
                    if (sub_categories.length > 0) {
                        return Object.assign({}, category, { sub_categories });
                    }
                    return;
                })
                .filter((sub_category) => sub_category);
        };
        return categories ? buildAssignableCategoriesTrees(categories) : [];
    };

    const findCategoryById = (id: number): Category | null => {
        const traverse = (categories: Category[]) => {
            for (const category of categories) {
                if (category.id === id) {
                    return category;
                }
                if (category.sub_categories) {
                    const found = traverse(category.sub_categories);
                    if (found) {
                        return found;
                    }
                }
            }
        };
        return categories ? traverse(categories) : null;
    };

    const refreshCategories = (refreshCategories: Category[] = []) => {
        const categoriesMap = refreshCategories.reduce((map, category) => {
            map[category.id] = category;
            return map;
        });

        const updateCategories = (categories: Category[]): Category[] => {
            return categories.map((category) => {
                const updatedCategory = categoriesMap[category.id] || category;

                if (updatedCategory.sub_categories) {
                    updatedCategory.sub_categories = updateCategories(
                        updatedCategory.sub_categories
                    );
                }

                return updatedCategory;
            });
        };

        setCategories(
            categories?.map((category) => {
                if (categoriesMap[category.id]) {
                    return categoriesMap[category.id];
                }
                return category;
            }) as Category[]
        );
    };

    useEffect(() => {
        loadCategories();
    }, [activeIntention, department?.id, extractionId, digitizationListId]);

    const contextValue: CategoriesContextProps = {
        categories,
        getAssignableCategoriesTrees,
        department,
        setDepartment,
        extractionId,
        setExtractionId,
        digitizationListId,
        setDigitizationListId,
        refreshCategories,
        findCategoryById,
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
