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
    Quota,
} from "../../adapters/ApiCategories";
import { Department } from "../../adapters/ApiDepartments";
import { CategoryNode } from "./CategoryNodeModel";
import { useToast } from "../toast/ToastContext";
import { useTranslation } from "react-i18next";
import { NodeType } from "./CategoryNodeType";

type CategoryUpdateParams = {
    name: string;
    description: string;
    assignable: boolean;
    departments: number[];
};

interface CategoryNodesContextProps {
    categoryNodes: CategoryNode[] | undefined;

    handleEditCategoryNode: (node: CategoryNode) => void;
    handleUpdateCategoryNode: (
        node: CategoryNode,
        params: CategoryUpdateParams
    ) => void;
    handleCloseCategoryNodeEdit: (node: CategoryNode) => void;
    handleDeleteCategoryNode: (node: CategoryNode) => void;
    handleInsertChildNode: (node: CategoryNode) => void;

    handleFocusNode: (node: CategoryNode) => void;
    handleFocusParentNode: () => void;
    handleFocusRootNode: () => void;
    handleFocusLevel: (level: number) => void;

    handleEditPercentage: (node: CategoryNode) => void;
    editPercentageNodes: CategoryNode[];
    handlePercentageChange: (node: CategoryNode, value: number) => void;
    handleUpdatePercentage: () => void;
    handleClosePercentageEdit: () => void;
    focusEditPercentageIndex: number;
    handleGoToNextPercentage: () => void;
    handleFocusPercentageNode: (node: CategoryNode) => void;
}

const CategoryNodesContext = createContext<
    CategoryNodesContextProps | undefined
>(undefined);

interface CategoryNodesProviderProps {
    categories: Category[] | undefined;
    selectedQuota: Quota | undefined;
    children: ReactNode;
    extractedCategories: boolean;
}

export const CategoryNodesProvider: React.FC<CategoryNodesProviderProps> = (
    props
) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const [rootNode, setRootNode] = useState<CategoryNode | undefined>(
        undefined
    );
    const [categoryNodes, setCategoryNodes] = useState<
        CategoryNode[] | undefined
    >(undefined);

    const [editPercentageNodes, setEditPercentageNodes] = useState<
        CategoryNode[]
    >([]);
    const [focusEditPercentageIndex, setFocusEditPercentageIndex] =
        useState<number>(0);

    const createCategoryNodes = (
        categories: Category[],
        selectedQuota?: Quota
    ) => {
        const quotaPagesCount = selectedQuota ? selectedQuota.pages_count : 0;
        const createdRootNode = CategoryNode.generateRootNode(
            t("all_categories"),
            categories,
            quotaPagesCount,
            props.extractedCategories
        );
        setRootNode(createdRootNode);
        setCategoryNodes([createdRootNode]);
    };

    const updateCategoryNodes = (
        categories: Category[],
        selectedQuota?: Quota
    ) => {
        if (!rootNode) {
            createCategoryNodes(categories, selectedQuota);
            return;
        }
        if (selectedQuota?.pages_count === rootNode.quota) {
            rootNode.updateChildren(categories);
        }
        const quotaPagesCount = selectedQuota ? selectedQuota.pages_count : 0;
        rootNode.aggregateStats(quotaPagesCount, 100);
        setCategoryNodes([...categoryNodes!]);
    };

    const handleEditCategoryNode = (node: CategoryNode) => {
        node.setType(NodeType.UpdateCategory);
        setCategoryNodes([...categoryNodes!]);
    };

    const handleCategoryUpdateError = (error: any) => {
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
    };

    const handleUpdateCategoryNode = (
        node: CategoryNode,
        params: CategoryUpdateParams
    ) => {
        const updatedCategory = {
            ...node.category,
            name: params.name,
            description: params.description,
            assignable: params.assignable,
            departments: params.departments,
            parent_id:
                node.category.parent_id !== 0 ? node.category.parent_id : null,
        };
        if (node.type === NodeType.CreateCategory) {
            ApiCategories.createCategory(updatedCategory)
                .then((response) => {
                    node.setCategory(response.data);
                    node.setType(NodeType.Category);
                    handleCloseCategoryNodeEdit(node);
                })
                .catch(handleCategoryUpdateError);
        } else if (node.type === NodeType.UpdateCategory) {
            ApiCategories.updateCategory(updatedCategory)
                .then((response) => {
                    node.setCategory(response.data);
                    handleCloseCategoryNodeEdit(node);
                })
                .catch(handleCategoryUpdateError);
        }
    };

    const handleCloseCategoryNodeEdit = (node: CategoryNode) => {
        if (node.type === NodeType.CreateCategory) {
            node.parentNode?.deleteChild(node);
        } else if (node.type === NodeType.UpdateCategory) {
            node.setType(NodeType.Category);
        }
        setCategoryNodes([...categoryNodes!]);
    };

    const handleDeleteCategoryNode = (node: CategoryNode) => {
        ApiCategories.deleteCategory(node.category.id)
            .then((response) => {
                node.parentNode?.deleteChild(node);
                setCategoryNodes([...categoryNodes!]);
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

    const handleInsertChildNode = (node: CategoryNode) => {
        node.insertChildNode();
        setCategoryNodes([...categoryNodes!]);
    };

    const handleFocusNode = (node: CategoryNode) => {
        setCategoryNodes([node]);
    };

    const handleFocusParentNode = () => {
        if (
            categoryNodes &&
            categoryNodes?.length > 0 &&
            categoryNodes[0].parentNode
        ) {
            setCategoryNodes([categoryNodes[0].parentNode]);
        }
    };

    const handleFocusRootNode = () => {
        setCategoryNodes([rootNode!]);
    };

    const handleFocusLevel = (level: number) => {};

    const handleEditPercentage = (node: CategoryNode) => {
        if (editPercentageNodes.length > 0) {
            return;
        }
        if (categoryNodes?.length === 1 && categoryNodes[0] === node) {
            setCategoryNodes([node.parentNode!]);
        }
        setEditPercentageNodes(node.parentNode!.children);
    };

    const handlePercentageChange = (node: CategoryNode, value: number) => {
        node.setPercentage(value);
    };

    const handleGoToNextPercentage = () => {
        if (focusEditPercentageIndex + 1 === editPercentageNodes.length) {
            handleUpdatePercentage();
            setFocusEditPercentageIndex(0);
        } else {
            setFocusEditPercentageIndex(focusEditPercentageIndex + 1);
        }
    };

    const handleFocusPercentageNode = (node: CategoryNode) => {
        editPercentageNodes.forEach((n, i) => {
            if (n === node) {
                setFocusEditPercentageIndex(i);
            }
        });
    };

    const handleUpdatePercentage = () => {
        const percentageSum = editPercentageNodes.reduce(
            (total, node) => total + (node.percentage || 0),
            0
        );
        console.log(percentageSum);
        if (percentageSum !== 100) {
            showToast("error", t("invalid_percentage_distribution"), "");
            return;
        }
        if (
            editPercentageNodes.filter(
                (node) => node.percentage !== node.category.percentage
            ).length > 0
        ) {
            const newDistribution: CategoryPercentage[] =
                editPercentageNodes.map((node) => ({
                    id: node.category.id,
                    percentage: node.percentage ? node.percentage : 0,
                }));
            const parentId: number | null =
                editPercentageNodes[0].parentNode!.category.id !== 0
                    ? editPercentageNodes[0].parentNode!.category.id
                    : null;
            ApiCategories.updateDistribution(parentId, newDistribution)
                .then((response) => {
                    editPercentageNodes.forEach((node) => {
                        node.setCategory({
                            ...node.category,
                            percentage: node.percentage,
                        });
                    });
                })
                .catch((error) => {
                    console.error(error);
                });
        }
        setEditPercentageNodes([]);
    };

    const handleClosePercentageEdit = () => {
        editPercentageNodes.forEach((node) =>
            node.setPercentage(node.category.percentage)
        );
        setEditPercentageNodes([]);
    };

    useEffect(() => {
        if (props.categories) {
            if (rootNode === undefined) {
                createCategoryNodes(props.categories, props.selectedQuota);
            } else {
                updateCategoryNodes(props.categories, props.selectedQuota);
            }
        }
    }, [props.categories, props.selectedQuota]);

    const contextValue: CategoryNodesContextProps = {
        categoryNodes,

        handleEditCategoryNode,
        handleUpdateCategoryNode,
        handleCloseCategoryNodeEdit,
        handleDeleteCategoryNode,
        handleInsertChildNode,

        handleFocusNode,
        handleFocusParentNode,
        handleFocusRootNode,
        handleFocusLevel,

        handleEditPercentage,
        editPercentageNodes,
        handlePercentageChange,
        handleUpdatePercentage,
        handleClosePercentageEdit,
        focusEditPercentageIndex,
        handleGoToNextPercentage,
        handleFocusPercentageNode,
    };

    return (
        <CategoryNodesContext.Provider value={contextValue}>
            {props.children}
        </CategoryNodesContext.Provider>
    );
};

export const useCategoryNodes = (): CategoryNodesContextProps => {
    const context = useContext(CategoryNodesContext);

    if (!context) {
        throw new Error(
            "useCategoryNodes must be used within a CategoryNodesProvider"
        );
    }

    return context;
};
