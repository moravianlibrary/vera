import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ToggleButton } from 'primereact/togglebutton';
import { Divider } from 'primereact/divider';
import { textEditor } from "../services/Editors";
import { Button } from "primereact/button";
import { dataService } from "../services/Data";
import { Menu } from 'primereact/menu';
import { OrganizationChart } from "primereact/organizationchart";
import { OverlayPanel } from 'primereact/overlaypanel';
import CategoryView from "../components/CategoryView";
import { Card } from 'primereact/card';
import { Category } from "../models/Category";
import { Panel } from 'primereact/panel';
import CategoryNode from "../components/CategoryView";

export const NodeType = {
    ROOT: 'ROOT',
    CATEGORY: 'CATEGORY',
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

        node.type = NodeType.CATEGORY;
        node.category = category;
        node.parentNode = parentNode;
        node.quota = quota;

        node.className = Node.getColorClass(NodeType.CATEGORY, category);

        const { children } = category;
        const quotas_tmp = children.slice(1, children.length).map(child => Number(child.calcQuota(quota)));
        const rest = quota - quotas_tmp.reduce((accumulator, quota) => accumulator + quota, 0);
        const quotas = [...quotas_tmp, rest];
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
        childNode.category = Category.createChildCategory(this.category.level + 1);
        childNode.className = Node.getColorClass(NodeType.CATEGORY, childNode.category);
        this.children.splice(this.children.length - 1, 0, childNode);
    }

    setType(type) {
        this.type = type;
    }

    setPercentage(percentage) {
        this.percentage = percentage;
    }
}

const Categories = (props) => {
    const { t } = useTranslation();

    const [categories, setCategories] = useState([]);
    const [departments, setDepartments] = useState([]);

    const [activeNode, setActiveNode] = useState(null);
    const [rootNode, setRootNode] = useState(null);

    const [insertMode, setInsertMode] = useState(false);

    const [editingRows, setEditingRows] = useState([]);
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
    };

    const handleCloseCategoryEditing = (node) => {
        node.setType(NodeType.CATEGORY);
        refresh();
    };

    const handleDeleteCategory = (node) => {
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