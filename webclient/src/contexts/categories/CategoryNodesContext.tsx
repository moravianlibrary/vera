import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiCategories, {
    Category,
    CategoryPercentage,
    CreateCategory,
    Quota,
} from "../../adapters/ApiCategories";
import { CategoryModel } from "./CategoryModel";
import { useToast } from "../toast/ToastContext";
import { useTranslation } from "react-i18next";
import { CategoryType } from "./CategoryType";
import { useCategories } from "./CategoriesContext";

interface CategoryModelsContextProps {
    currentCategory: CategoryModel | undefined;

    addCategory: (toCategory: CategoryModel) => void;
    createCategory: (category: CreateCategory) => void;

    editCategory: CategoryModel | null;
    openCategoryEdit: (category: CategoryModel) => void;
    closeCategoryEdit: () => void;

    updateCategory: (category: CreateCategory) => void;
    deleteCategory: (category: CategoryModel) => void;

    activeLevel: number | null;
    focusAssignable: boolean;
    focusRootCategory: () => void;
    focusParentCategory: () => void;
    focusCategory: (category_id: number) => void;
    focusLevel: (level: number) => void;
    focusAssignableCategories: () => void;

    editDistribution: CategoryModel | null;
    setEditDistribution: (distribution: CategoryModel | null) => void;
    saveDistribution: () => void;
}

const CategoryModelsContext = createContext<
    CategoryModelsContextProps | undefined
>(undefined);

interface CategoryModelsProviderProps {
    categories: Category[] | undefined;
    selectedQuota: Quota | undefined;
    children: ReactNode;
    extractedCategories: boolean;
}

export const CategoryModelsProvider: React.FC<CategoryModelsProviderProps> = (
    props
) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { refreshCategories } = useCategories();

    const [rootNode, setRootNode] = useState<CategoryModel | undefined>(
        undefined
    );
    const [currentCategory, setCurrentCategory] = useState<
        CategoryModel | undefined
    >(undefined);

    const [editCategory, setEditCategory] = useState<CategoryModel | null>(
        null
    );

    const [activeLevel, setActiveLevel] = useState<number | null>(0);
    const [focusAssignable, setFocusAssignable] = useState<boolean>(false);

    const [editDistribution, setEditDistribution] =
        useState<CategoryModel | null>(null);

    const createCategoryModels = (
        categories: Category[],
        selectedQuota?: Quota
    ) => {
        const quotaPagesCount = selectedQuota ? selectedQuota.pages_count : 0;
        const createdRootNode = CategoryModel.generateRootNode(
            t("all_categories"),
            categories,
            quotaPagesCount
        );
        setRootNode(createdRootNode);
        setCurrentCategory(createdRootNode);
    };

    const addCategory = (toCategory: CategoryModel) => {
        if (!editCategory) {
            openCategoryEdit(toCategory.insertChildNode());
        }
    };

    const createCategory = (category: CreateCategory) => {
        ApiCategories.createCategory(category.parent_id, category)
            .then((response) => {
                editCategory?.setCategory(response.data);
                editCategory?.setType(CategoryType.Category);
                editCategory?.addCategory(response.data);
                closeCategoryEdit();
            })
            .catch((error) => {
                console.error(error);
            });
    };

    const openCategoryEdit = (category: CategoryModel) => {
        if (editCategory !== null) {
            return;
        }
        setEditCategory(category);
    };

    const closeCategoryEdit = () => {
        if (editCategory && editCategory.type === CategoryType.NewCategory) {
            editCategory.parent!.deleteChild(editCategory.id);
        }
        setEditCategory(null);
    };

    const updateCategory = (category: CreateCategory) => {
        if (!editCategory) {
            return;
        }
        const categoryId = editCategory.id;
        ApiCategories.updateCategory(categoryId, category)
            .then((response) => {
                if (response.status === 200) {
                    editCategory.setCategory(response.data);
                    closeCategoryEdit();
                }
            })
            .catch((error) => {
                if (
                    error.response &&
                    error.response.status &&
                    error.response.status == 409
                ) {
                    showToast(
                        "error",
                        t("unique_category_name_violation"),
                        t("unique_category_name_violation_detail")
                    );
                } else {
                    console.error(error);
                }
            });
    };

    const deleteCategory = (category: CategoryModel) => {
        ApiCategories.deleteCategory(category.id)
            .then(() => {
                category.parent?.deleteChild(category.id);
                refreshCategories();
            })
            .catch((error) => {
                if (
                    error.response &&
                    error.response.status &&
                    400 <= error.response.status &&
                    error.response.status < 500
                ) {
                    showToast(
                        "error",
                        t("Category deletion failed"),
                        t(error.response.data.detail)
                    );
                } else {
                    console.error(error);
                }
            });
    };

    const updateCategoryModels = (
        categories: Category[],
        selectedQuota?: Quota
    ) => {
        if (!rootNode) {
            createCategoryModels(categories, selectedQuota);
            return;
        }
        if (selectedQuota?.pages_count === rootNode.quota) {
            rootNode.updateChildren(categories);
        }
        const quotaPagesCount = selectedQuota ? selectedQuota.pages_count : 0;
        rootNode.aggregateStats(quotaPagesCount, 100);
    };

    const changeFocus = (
        category: CategoryModel,
        level: number | null,
        assignable: boolean
    ) => {
        setCurrentCategory(category);
        setActiveLevel(level);
        setFocusAssignable(assignable);
    };

    const focusRootCategory = () => {
        changeFocus(rootNode!, 0, false);
    };

    const focusParentCategory = () => {
        if (currentCategory && currentCategory.parent) {
            if (currentCategory.parent.type === CategoryType.Root) {
                focusRootCategory();
            } else {
                changeFocus(currentCategory.parent, null, false);
            }
        }
    };

    const focusCategory = (category_id: number) => {
        const focusCategory = rootNode!.getCategoryModelById(category_id);
        if (focusCategory) {
            changeFocus(focusCategory, null, false);
        } else {
            focusRootCategory();
        }
    };

    const focusLevel = (level: number) => {
        if (level === 0) {
            focusRootCategory();
            return;
        }
        changeFocus(
            CategoryModel.generateLevelRootNode(
                `${t("Categories of level")} ${level}`,
                rootNode!.getNodesByLevel(level)
            ),
            level,
            false
        );
    };

    const focusAssignableCategories = () => {
        changeFocus(
            CategoryModel.generateLevelRootNode(
                t("Assignable categories"),
                rootNode!.getAssignableCategoryModels()
            ),
            null,
            true
        );
    };

    const saveDistribution = () => {
        console.log(editDistribution);

        if (editDistribution === null) {
            return;
        }

        const percentageSum = editDistribution.children.reduce(
            (total, node) => total + (node.percentage || 0),
            0
        );
        if (percentageSum !== 100) {
            showToast("error", t("invalid_percentage_distribution"), "");
            return;
        }

        if (
            editDistribution.children.filter(
                (node) => node.percentage !== node.percentage
            ).length > 0
        ) {
            const newDistribution: CategoryPercentage[] =
                editDistribution.children.map((node) => ({
                    id: node.id,
                    percentage: node.percentage ? node.percentage : 0,
                }));
            ApiCategories.updateDistribution(
                editDistribution.id,
                newDistribution
            )
                .then((response) => {
                    editDistribution.children.forEach((node) => {
                        node.setCategory({
                            percentage: node.percentage,
                        });
                    });
                })
                .catch((error) => {
                    console.error(error);
                });
        }
        setEditDistribution(null);
    };

    useEffect(() => {
        if (props.categories) {
            if (rootNode === undefined) {
                createCategoryModels(props.categories, props.selectedQuota);
            } else {
                updateCategoryModels(props.categories, props.selectedQuota);
            }
        }
    }, [props.categories, props.selectedQuota]);

    const contextValue: CategoryModelsContextProps = {
        currentCategory,

        addCategory,
        createCategory,

        editCategory,
        openCategoryEdit,
        closeCategoryEdit,

        updateCategory,
        deleteCategory,

        activeLevel,
        focusAssignable,
        focusRootCategory,
        focusParentCategory,
        focusCategory,
        focusLevel,
        focusAssignableCategories,

        editDistribution,
        setEditDistribution,
        saveDistribution,
    };

    return (
        <CategoryModelsContext.Provider value={contextValue}>
            {props.children}
        </CategoryModelsContext.Provider>
    );
};

export const useCategoryModels = (): CategoryModelsContextProps => {
    const context = useContext(CategoryModelsContext);

    if (!context) {
        throw new Error(
            "useCategoryModels must be used within a CategoryModelsProvider"
        );
    }

    return context;
};
