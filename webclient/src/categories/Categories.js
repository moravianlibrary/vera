import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Divider } from 'primereact/divider';
import { Button } from "primereact/button";
import { dataService } from "../services/Data";
import { OrganizationChart } from "primereact/organizationchart";
import { Category } from "../models/Category";
import CategoryNode from "../components/CategoryView";

export const NodeType = {
    ROOT: 'ROOT',
    CATEGORY: 'CATEGORY',
    DISABLED: 'DISABLED',
    UPDATE_CATEGORY: 'UPDATE_CATEGORY',
    INSERT: 'INSERT'
};

class Node {
    type;
    expanded = true;
    className = 'bg-yellow-500';
    style = { borderRadius: '12px' };
    category;
    parentNode;
    percentage;
    quota;
    children = [];

    static getColorClass(type, category) {
        if (type == NodeType.ROOT) {
            return 'bg-cyan-400';
        }
        if (type == NodeType.INSERT) {
            return 'bg-blue-100';
        }
        if (category.assignable) {
            return 'bg-yellow-500';
        }
        if (category.disabled) {
            return 'surface-300';
        }
        switch (category.level) {
            case 0: return 'bg-teal-400';
            case 1: return 'bg-teal-300';
            case 2: return 'bg-teal-200';
            case 3: return 'bg-teal-100';
        }
    }

    static createCategoryNode(category, parentNode, quota, expanded) {
        const node = new Node();

        node.type = category.disabled ? NodeType.DISABLED : NodeType.CATEGORY;
        node.category = category;
        node.parentNode = parentNode;
        node.quota = quota;

        node.className = Node.getColorClass(NodeType.CATEGORY, category);

        const { children } = category;
        const quotas_tmp = children.map(child => Number(child.calcQuota(quota)));
        const difference = quota - quotas_tmp.reduce((accumulator, quota) => accumulator + quota, 0);

        const quotas = difference !== 0
                ? quotas_tmp.reverse()
                    .map((quota, index) => index === quotas_tmp.slice().reverse().findIndex(q => q !== 0) ? quota + difference : quota)
                    .reverse()
                : quotas_tmp;

        node.children = children
                ? children.map((child, index) => Node.createCategoryNode(child, node, quotas[index], expanded))
                : [];

        return node;
    }

    static createRootNode(category, quota, expanded) {
        const node = Node.createCategoryNode(category, null, quota, expanded);
        node.type = NodeType.ROOT;
        node.className = Node.getColorClass(NodeType.ROOT);
        return node;
    }

    createInsertNode() {
        const node = new Node();
        node.type = NodeType.INSERT;
        node.className = Node.getColorClass(NodeType.INSERT);
        node.parentNode = this;
        return node;
    }

    createInsertNodes() {
        if (this.category.level < 4
                && (this.children.length == 0
                    || this.children.every(child => child.type == NodeType.CATEGORY))) {
            this.children.forEach(child => child.createInsertNodes());
            this.children = [...this.children, this.createInsertNode()];
        }
    }
    
    clearInsertNodes() {
        this.children = this.children.filter(child => child.type != NodeType.INSERT);
        this.children.forEach(child => child.clearInsertNodes());
    }

    insertNewCategoryNode() {
        const childNode = new Node();
        childNode.type = NodeType.UPDATE_CATEGORY;
        childNode.category = this.category.createChildCategory();
        childNode.className = Node.getColorClass(NodeType.CATEGORY, childNode.category);
        this.children.splice(this.children.length - 1, 0, childNode);
    }

    setType(type) {
        this.type = type;
    }

    setPercentage(percentage) {
        this.percentage = percentage;
    }

    setCategory(category) {
        this.category = category;
    }

    deleteChild(node) {
        this.children = this.children.filter(child => child !== node);
    }
}

const Categories = (props) => {
    const { t } = useTranslation();

    const [categories, setCategories] = useState([]);
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
    };

    const handleCloseCategoryEditing = (node) => {
        node.setType(NodeType.CATEGORY);
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
        node.parentNode.children.forEach(child => child.setPercentage(child.category.percentage));
        setEditPercentageNodes(node.parentNode.children);
    };

    const onPercentageChange = (node, value) => {
        console.log(editPercentageNodes);
        node.setPercentage(value);
    }

    const handleUpdatePercentage = () => {
        const sum = editPercentageNodes.reduce((accumulator, node) => accumulator + node.percentage, 0);
        console.log(sum);
        if (sum == 100) {
            const parent_id = editPercentageNodes[0].category.parent_id;
            const distribution = editPercentageNodes.map((node) => {
                return {
                    id: node.category.id,
                    percentage: node.percentage,
                };
            });
            if (dataService.updateDistribution(parent_id, distribution)) {
                setEditPercentageNodes([]);
                editPercentageNodes.map((node) => node.category.setPercentage(node.percentage));
            }
        }
    };

    const handleClosePercentageEditing = () => {
        editPercentageNodes.forEach((node) => node.setPercentage(node.category.percentage));
        setEditPercentageNodes([]);
    };

    useEffect(() => {
        async function fetchCategories() {
            const categories = await dataService.getCategories();
            setCategories(categories);
            if (categories && categories.length > 0) {
                const rootCategory = Category.createRootCategory(t('all_categories'), categories);
                const rootNode = Node.createRootNode(rootCategory, 994, true);
                setRootNode(rootNode);
                setActiveNode(rootNode);
            }
            const departments = await dataService.getDepartments();
            setDepartments(departments);
        }
        if (!insertMode) {
            fetchCategories();
        }
    }, []);

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
        <div>
            <div className="flex flex-column" style={floatingPanelStyle}>
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
                nodeTemplate={(node) => <CategoryNode node={node}
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