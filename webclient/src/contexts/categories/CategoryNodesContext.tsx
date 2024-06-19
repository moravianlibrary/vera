import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
    ChildContextProvider,
} from "react";
import ApiCategories, {
    Category,
    ChildDistribution,
    CreateCategory,
    ParentDistribution,
} from "../../adapters/ApiCategories";
import { CategoryModel } from "./CategoryModel";
import { useToast } from "../toast/ToastContext";
import { useTranslation } from "react-i18next";
import { CategoryType } from "./CategoryType";
import { useCategories } from "./CategoriesContext";
import { useIntentions } from "./IntentionsContext";

interface CategoryModelsContextProps {
    currentCategory: CategoryModel | null;

    addCategory: (toCategory: CategoryModel) => void;
    createCategory: (category: CreateCategory, parentId: number | null) => void;

    editCategory: CategoryModel | null;
    openCategoryEdit: (category: CategoryModel) => void;
    closeCategoryEdit: () => void;

    updateCategory: (category: CreateCategory) => void;
    deleteCategory: (category: CategoryModel) => void;

    showIntentionOnly: boolean;
    setShowIntentionOnly: (filter: boolean) => void;

    activeLevel: number | null;
    focusAssignable: boolean;
    focusRootCategory: () => void;
    focusParentCategory: () => void;
    focusCategory: (category_id: number | null) => void;
    focusLevel: (level: number) => void;
    focusAssignableCategories: () => void;

    editDistribution: CategoryModel | null;
    setEditDistribution: (distribution: CategoryModel | null) => void;
    saveDistribution: (parentDistribution: ParentDistribution) => void;
}

const CategoryModelsContext = createContext<
    CategoryModelsContextProps | undefined
>(undefined);

interface CategoryModelsProviderProps {
    children: ReactNode;
}

export const CategoryModelsProvider: React.FC<CategoryModelsProviderProps> = (
    props
) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { categories, refreshCategories } = useCategories();
    const { activeIntention } = useIntentions();

    const [rootNode, setRootNode] = useState<CategoryModel | undefined>(
        undefined
    );
    const [currentCategory, setCurrentCategory] =
        useState<CategoryModel | null>(null);

    const [editCategory, setEditCategory] = useState<CategoryModel | null>(
        null
    );

    const [showIntentionOnly, setShowIntentionOnly] = useState<boolean>(false);
    const [activeLevel, setActiveLevel] = useState<number | null>(0);
    const [focusAssignable, setFocusAssignable] = useState<boolean>(false);

    const [editDistribution, setEditDistribution] =
        useState<CategoryModel | null>(null);

    const createCategoryModels = (categories: Category[]) => {
        const createdRootNode = CategoryModel.generateRootNode(
            CategoryType.Root,
            t("all_categories"),
            categories,
            showIntentionOnly && activeIntention !== null
        );
        setRootNode(createdRootNode);
        setCurrentCategory(createdRootNode);
    };

    const addCategory = (toCategory: CategoryModel) => {
        if (!editCategory) {
            openCategoryEdit(toCategory.insertChildNode());
        }
    };

    const createCategory = (
        category: CreateCategory,
        parentId: number | null
    ) => {
        ApiCategories.createCategory(category, parentId)
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

    const updateCategoryModels = (categories: Category[]) => {
        if (!rootNode) {
            createCategoryModels(categories);
            return;
        }
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

    const focusCategory = (category_id: number | null) => {
        if (category_id === null) {
            focusRootCategory();
            return;
        }
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
            CategoryModel.generateRootNode(
                CategoryType.LevelRoot,
                `${t("Categories of level")} ${level}`,
                rootNode!.getNodesByLevel(level),
                showIntentionOnly && activeIntention !== null
            ),
            level,
            false
        );
    };

    const focusAssignableCategories = () => {
        changeFocus(
            CategoryModel.generateRootNode(
                CategoryType.LevelRoot,
                t("Assignable categories"),
                rootNode!.getAssignableCategoryModels(),
                showIntentionOnly && activeIntention !== null
            ),
            null,
            true
        );
    };

    const saveDistribution = (parentDistribution: ParentDistribution) => {
        if (!editDistribution) {
            return;
        }

        const percentageSum = parentDistribution.distributions.reduce(
            (total, node) => total + (node.percentage || 0),
            0
        );
        if (percentageSum !== 100) {
            showToast("error", t("invalid_percentage_distribution"), "");
            return;
        }

        ApiCategories.updateDistribution(
            parentDistribution,
            editDistribution.id > 0 ? editDistribution.id : null
        )
            .then((response) => {
                refreshCategories(response.data);
            })
            .catch((error) => {
                console.error(error);
            });

        setEditDistribution(null);
    };

    useEffect(() => {
        if (categories) {
            createCategoryModels(categories);
        }
    }, [categories, showIntentionOnly]);

    const contextValue: CategoryModelsContextProps = {
        currentCategory,

        addCategory,
        createCategory,

        editCategory,
        openCategoryEdit,
        closeCategoryEdit,

        updateCategory,
        deleteCategory,

        showIntentionOnly,
        setShowIntentionOnly,

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
