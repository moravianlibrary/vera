import NodeType from "./CategoryNodeType";

export class CategoryNode {
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
        const node = new CategoryNode();

        node.type = category.disabled ? NodeType.DISABLED : NodeType.CATEGORY;
        node.category = category;
        node.parentNode = parentNode;
        node.quota = quota;

        node.className = CategoryNode.getColorClass(NodeType.CATEGORY, category);

        const { children } = category;
        const quotas_tmp = children.map(child => Number(child.calcQuota(quota)));
        const difference = quota - quotas_tmp.reduce((accumulator, quota) => accumulator + quota, 0);

        const quotas = difference !== 0
                ? quotas_tmp.reverse()
                    .map((quota, index) => index === quotas_tmp.slice().reverse().findIndex(q => q !== 0) ? quota + difference : quota)
                    .reverse()
                : quotas_tmp;

        node.children = children
                ? children.map((child, index) => CategoryNode.createCategoryNode(child, node, quotas[index], expanded))
                : [];
        
        return node;
    }

    static createRootNode(category, quota, expanded) {
        const node = CategoryNode.createCategoryNode(category, null, quota, expanded);
        node.type = NodeType.ROOT;
        node.className = CategoryNode.getColorClass(NodeType.ROOT);
        return node;
    }

    createInsertNode() {
        const node = new CategoryNode();
        node.type = NodeType.INSERT;
        node.className = CategoryNode.getColorClass(NodeType.INSERT);
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
        const childNode = new CategoryNode();
        childNode.parentNode = this;
        childNode.type = NodeType.UPDATE_CATEGORY;
        childNode.category = this.category.createChildCategory();
        childNode.className = CategoryNode.getColorClass(NodeType.CATEGORY, childNode.category);
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
