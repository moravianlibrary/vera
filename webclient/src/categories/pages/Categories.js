import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Divider } from 'primereact/divider';
import { Button } from "primereact/button";
import { dataService } from "../../services/Data";
import { OrganizationChart } from "primereact/organizationchart";
import { Category } from "../models/Category";
import CategoryNodeComponent from "../components/CategoryNodeComponent";
import NodeType from "../models/CategoryNodeType";
import { CategoryNode } from "../models/CategoryNode";

const Categories = (props) => {
    const { t } = useTranslation();

    const [categories, setCategories] = useState([]);
    const [quotas, setQuotas] = useState([]);
    const [activeQuota, setActiveQuota] = useState(null);
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
                node.setCategory(Category.fromJson(response.data));
            });
        }
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

    useEffect(() => {
        async function fetchQuotas() {
            const quotas = await dataService.getQuotas();
            setQuotas(quotas);
            setActiveQuota(quotas.find(quota => quota.active));
        }
        async function fetchCategories() {
            const categories = await dataService.getCategories();
            const quotas = await dataService.getQuotas();
            const quota = quotas.find(quota => quota.active);
            setCategories(categories);
            if (categories && categories.length > 0) {
                const rootCategory = Category.createRootCategory(t('all_categories'), categories);
                const rootNode = CategoryNode.createRootNode(rootCategory, quota.pages_count, true);
                setRootNode(rootNode);
                setActiveNode(rootNode);
            } else {
                const rootCategory = Category.createRootCategory(t('all_categories'), []);
                const rootNode = CategoryNode.createRootNode(rootCategory, quota.pages_count, true);
                setRootNode(rootNode);
                setActiveNode(rootNode);
            }
            const departments = await dataService.getDepartments();
            setDepartments(departments);
        }
        if (!insertMode) {
            fetchQuotas();
            fetchCategories();
        }
    }, [refreshDataCount]);

    const floatingPanelStyle = {
        position: 'absolute',
        // position: 'fixed',
        top: '20px',
        left: '20px',
        zIndex: '1000',
        boxShadow: '0px 0px 10px 0px rgba(0,0,0,0.35)',
        margin: '0px',
        padding: '0px',
    };

    return (
        <div style={{ overflow: "auto" }}>
            <div className="flex flex-column bg-white" style={floatingPanelStyle}>
                <Button
                    className="m-0"
                    text
                    icon="pi pi-eye"
                    label={t('show_all_categories')}
                    onClick={(e) => setActiveNode(rootNode)}
                />
                <Divider className="m-0" />
                <Button
                    className="m-0"
                    text
                    icon="pi pi-eye"
                    label={t('insert_mode')}
                    onClick={(e) => toggleInsertMode()}
                />
            </div>
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