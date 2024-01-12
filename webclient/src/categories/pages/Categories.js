import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { useData } from "../../services/Data";
import { OrganizationChart } from "primereact/organizationchart";
import { Category } from "../models/Category";
import CategoryNodeComponent from "../components/CategoryNodeComponent";
import NodeType from "../models/CategoryNodeType";
import { CategoryNode } from "../models/CategoryNode";
import CategoriesMenuPanel from "../panels/CategoriesMenuPanel";
import QuotasMenuPanel from "../panels/QuotasMenuPanel";
import { Quota } from "../models/Quota";

const Categories = (props) => {
    const { t } = useTranslation();
    const { dataService } = useData();

    const [categories, setCategories] = useState([]);
    const [quotas, setQuotas] = useState([]);
    const [selectedQuota, selectQuota] = useState(Quota.emptyQuota(t('empty_quota')));
    const [departments, setDepartments] = useState([]);

    const [activeNode, setActiveNode] = useState(null);
    const [rootNode, setRootNode] = useState(null);

    const [insertMode, setInsertMode] = useState(false);

    const [editPercentageNodes, setEditPercentageNodes] = useState([]);

    const [refreshCount, setRefreshCount] = useState(0);
    const [refreshDataCount, setRefreshDataCount] = useState(0);

    const refresh = () => {
        setRefreshCount(refreshCount + 1);
    };

    const refreshData = () => {
        setRefreshDataCount(refreshDataCount + 1);
    };

    const handleClickNode = (node) => {
        if (node.type == NodeType.ROOT || node.type == NodeType.CATEGORY) {
            setActiveNode(node);
        } else if (node.type == NodeType.INSERT) {
            node.parentNode.insertNewCategoryNode();
        }
        refresh();
    };

    const handleMoveUpCategory = () => {
        setActiveNode(activeNode.parentNode);
        if (insertMode) {
            activeNode.parentNode.createInsertNodes();
        }
        refresh();
    }

    const toggleInsertMode = () => {
        if (!insertMode) {
            activeNode.createInsertNodes();
        } else {
            rootNode.clearInsertNodes();
        }
        setInsertMode(!insertMode);
    };

    const handleEditCategory = (node) => {
        node.setType(NodeType.UPDATE_CATEGORY);
        refresh();
    };

    const handleUpdateCategory = (node, values) => {
        if (node.category.id) {
            dataService.updateCategory(node.category.createUpdateClone(values)).then(response => {
                node.category.update(response.data);
            });
        } else {
            dataService.createCategory(node.category.createUpdateClone(values)).then(response => {
                const category = Category.fromJson(response.data);
                node.setCategory(category);
                node.parentNode.category.children = [...node.parentNode.category.children, category];
            });
        }
        handleUpdatePercentage();
        node.setType(NodeType.CATEGORY);
    };

    const handleCloseCategoryEditing = (node) => {
        if (node.type === NodeType.UPDATE_CATEGORY && !node.category.id) {
            node.parentNode.deleteChild(node);
        }
        refresh();
    };

    const handleDeleteCategory = (node) => {
        if (node.category.isEmpty()) {
            dataService.deleteCategory(node.category);
            node.parentNode.deleteChild(node);
            refresh();
        }
    };

    const handleEditPercentage = (node) => {
        const valueNodes = node.parentNode.children.filter(child => child.type !== NodeType.INSERT);
        valueNodes.forEach(child => child.setPercentage(child.category.percentage));
        setEditPercentageNodes(valueNodes);
    };

    const onPercentageChange = (node, value) => {
        node.setPercentage(value);
    }

    const handleUpdatePercentage = () => {
        const sum = editPercentageNodes.reduce((accumulator, node) => accumulator + node.percentage, 0);
        if (sum == 100 || sum == 0) {
            const parent_id = editPercentageNodes[0].category.parent_id;
            const distribution = editPercentageNodes.map((node) => {
                return {
                    id: node.category.id,
                    percentage: node.percentage,
                };
            });
            if (dataService.updateDistribution(parent_id, distribution)) {
                editPercentageNodes.map((node) => node.category.setPercentage(node.percentage));
                setEditPercentageNodes([]);
                refreshData();
            }
        }
    };

    const handleClosePercentageEditing = () => {
        editPercentageNodes.forEach((node) => node.setPercentage(node.category.percentage));
        setEditPercentageNodes([]);
    };

    const handleSelectQuota = (quota) => {
        selectQuota(quota);
        refreshData();
    };

    const handleUpdateQuota = async (quota) => {
        if (quota.id) {
            const updatedQuota = await dataService.updateQuota(quota);
            const updatedQuotas = quotas.map(q => {
                if (q.id === updatedQuota.id) {
                    return updatedQuota;
                }
                if (quota.active && q.active) {
                    q.active = false;
                }
                return q;
            });
            setQuotas(updatedQuotas);
            selectQuota(updatedQuota);
        } else {
            const newQuota = await dataService.createQuota(quota);
            setQuotas([...quotas, newQuota]);
        }
    };

    const handleDeleteQuota = (quota) => {
        if (dataService.deleteQuota(quota)) {
            setQuotas(quotas.filter(q => q != quota));
        }
    };

    const handleSetActiveQuota = (quota) => {
        quota.active = true;
        handleUpdateQuota(quota);
    };

    useEffect(() => {
        if (editPercentageNodes.length === 0) {
            refresh();
        }
    }, [editPercentageNodes]);

    useEffect(() => {
        if (!selectedQuota) {
            return;
        }
        const rootCategory = categories && categories.length > 0
                ? Category.createRootCategory(t('all_categories'), categories)
                : Category.createRootCategory(t('all_categories'), []);
        const rootNode = CategoryNode.createRootNode(rootCategory, selectedQuota.pages_count, true);
        setRootNode(rootNode);
        const newActive = activeNode ? rootNode.find(activeNode) : rootNode;
        if (insertMode) {
            newActive.createInsertNodes();
        }
        setActiveNode(newActive);
    }, [selectedQuota, categories]);

    useEffect(() => {
        async function fetchCategories() {
            const categories = await dataService.getCategories();
            console.log(categories);
            setCategories(categories);
        }
        async function fetchQuotas() {
            const quotas = await dataService.getQuotas();
            setQuotas(quotas);
            const activeQuota = quotas.find(quota => quota.active);
            if (activeQuota) {
                selectQuota(activeQuota);
            }
        }
        async function fetchDepartments() {
            const departments = await dataService.getDepartments();
            setDepartments(departments);
        }
        fetchCategories();
        fetchQuotas();
        fetchDepartments();
    }, []);

    return (
        <div style={{ overflow: "auto" }}>
            <CategoriesMenuPanel
                onShowAllCategories={(e) => setActiveNode(rootNode)}
                onToggleInsertMode={toggleInsertMode}
            />
            <QuotasMenuPanel
                selectedQuota={selectedQuota}
                quotas={quotas}
                onSelect={handleSelectQuota}
                onUpdate={handleUpdateQuota}
                onDelete={handleDeleteQuota}
                onSetActive={handleSetActiveQuota}
            />
            <div className="flex justify-content-center m-5">
                {activeNode && activeNode.parentNode &&
                <Button
                    size="large"
                    rounded
                    icon="pi pi-caret-up"
                    onClick={handleMoveUpCategory}
                />}
            </div>
            {activeNode &&
            <OrganizationChart
                value={[activeNode]}
                nodeTemplate={(node) => <CategoryNodeComponent node={node}
                    departments={departments}
                    onClick={handleClickNode}
                    onEdit={handleEditCategory}
                    onUpdate={handleUpdateCategory}
                    onCloseEditing={handleCloseCategoryEditing}
                    // onDisable={handleDisableCategory}
                    onDelete={handleDeleteCategory}
                    onEditPercentage={handleEditPercentage}
                    editPercentageNodes={editPercentageNodes}
                    onPercentageChange={onPercentageChange}
                    onUpdatePercentage={handleUpdatePercentage}
                    onClosePercentageEditing={handleClosePercentageEditing}
                />}
            />}
        </div>
    );
};

export default Categories;