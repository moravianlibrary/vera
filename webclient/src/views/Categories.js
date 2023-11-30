import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
    INSERT: 'INSERT'
};

class Node {
    expanded = true;
    className = 'bg-yellow-500';
    style = { borderRadius: '12px' };
    category;
    parentNode;
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

    static createInsertNode() {
        const node = new Node();
        node.type = NodeType.INSERT;
        node.className = Node.getColorClass(NodeType.INSERT);
        return node;
    }

    createInsertNodes() {
        if (this.type != NodeType.INSERT) {
            this.children.forEach(child => child.createInsertNodes());
            this.children = [...this.children, Node.createInsertNode()];
        }
    }
}

const Categories = (props) => {
    const { t } = useTranslation();

    const [categories, setCategories] = useState([]);
    const [activeNode, setActiveNode] = useState(null);
    const [rootNode, setRootNode] = useState(null);

    const [insertMode, setInsertMode] = useState(false);

    const [editingRows, setEditingRows] = useState([]);
    const [refreshCount, setRefreshCount] = useState(0);

    const handleMoveUpCategory = () => {
        setActiveNode(activeNode.parentNode);
    }

    const handleInsertMode = (e) => {
        activeNode.createInsertNodes();
    };

    const handleInsert = () => {
        if (!insertMode) {
            setInsertMode(true);
            const newCategory = {};
            setCategories([...categories, newCategory]);
            setEditingRows([...editingRows, newCategory]);
        }
    };

    const onRowEditChange = (event) => {
        const { data, index } = event;
        if (insertMode && index == categories.length - 1) {
            setInsertMode(false);
        }
        const activeRowArray = Array.isArray(data) ? data : [data];
        setEditingRows(activeRowArray);
    };

    const handleCategoryEdit = (event) => {
        const { newData, index } = event;

        if (insertMode && index == categories.length - 1) {
            dataService.createCategory(newData);
        } else {
            dataService.updateCategory(newData);
            setRefreshCount(refreshCount + 1);
        }
    };

    const handleDeleteCategory = (category) => {
        dataService.deleteCategory(category);
        setRefreshCount(refreshCount + 1);
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
        }
        if (!insertMode) {
            fetchCategories();
        }
    }, [insertMode, refreshCount]);

    const deleteButton = (category) => {
        if (!insertMode || category.id) {
            return (
                <Button className="p-button-rounded p-button-text p-button-danger" icon="pi pi-trash" onClick={() => handleDeleteCategory(category)} />
            );
        }
    };

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
                    onClick={handleInsertMode}
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
                nodeTemplate={(node) => <CategoryNode node={node} onClick={setActiveNode} />}
            />}
        </div>
    );
};

export default Categories;