import { Category, CreateCategory, Quota } from "../../adapters/ApiCategories";
import { NodeType } from "./CategoryNodeType";

export class CategoryNode {
    type: NodeType;
    category: Category;
    quota: number;
    percentage: number | undefined;
    parentNode: CategoryNode | undefined;
    children: CategoryNode[] = [];

    className = 'bg-yellow-500';
    expanded: boolean = true;
    style = { borderRadius: '12px' };

    constructor(type: NodeType, category: Category, quota: number, parentNode?: CategoryNode) {
        this.type = type;
        this.quota = quota;
        this.parentNode = parentNode;
        this.percentage = category.percentage;
        this.className = CategoryNode.getClassName(type, category);

        const childrenQuotas = CategoryNode.getChildrenQuotas(category.children, quota);
        this.children = category.children.map((child, index) => (
            new CategoryNode(NodeType.Category, child, childrenQuotas[index], this)))
            .sort((a, b) => a.category.id - b.category.id);

        this.setCategory(category);
    }

    static generateRootNode(name: string, categories: Category[], quota: number): CategoryNode {
        const rootCategory: Category = {
            id: 0,
            name: name,
            description: null,
            parent_id: null,

            assignable: false,
            disabled: false,
            departments: [],

            percentage: 100,
            level: -1,

            count_pages: categories.reduce((total, category) => total + category.count_pages, 0),
            count_documents_with_pages: categories.reduce((total, category) => total + category.count_documents_with_pages, 0),
            count_documents: categories.reduce((total, category) => total + category.count_documents, 0),
            
            children: categories
        }
        return new CategoryNode(NodeType.Root, rootCategory, quota);
    }

    static getClassName(type: NodeType, category?: Category): string {
        if (type === NodeType.Root) {
            return 'bg-cyan-400';
        }
        if (type === NodeType.Insert) {
            return 'bg-blue-100';
        }
        if (category) {
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
        return '';
    }

    static getChildrenQuotas(children: Category[], quota: number) {
        const quotas_tmp: number[] = children.map(child => {
            return Math.floor((quota * (child.percentage || 0)) / 100);
        });
        const difference = quota - quotas_tmp.reduce((accumulator, quota) => accumulator + quota, 0);

        return difference !== 0
                ? quotas_tmp.reverse()
                    .map((quota, index) => index === quotas_tmp.slice().reverse().findIndex(q => q !== 0) ? quota + difference : quota)
                    .reverse()
                : quotas_tmp;
    }

    insertChildNode() {
        const newCategory: Category = {
            id: this.children.reduce((total, child) => total + child.category.id, 0),
            name: "",
            description: null,
            parent_id: this.category.id,

            assignable: false,
            disabled: false,
            departments: this.category.departments,

            percentage: 0,
            level: this.category.level + 1,

            count_pages: 0,
            count_documents_with_pages: 0,
            count_documents: 0,
            
            children: []
        };
        const newNode = new CategoryNode(NodeType.CreateCategory, newCategory, 0, this);
        this.children = [...this.children, newNode];
    }

    // static createCategoryNode(category, parentNode, quota, expanded) {
    //     const node = new CategoryNode();

    //     node.type = NodeType.Category;
    //     node.category = category;
    //     node.parentNode = parentNode;
    //     node.quota = quota;

    //     node.className = CategoryNode.getClassName(NodeType.Category, category);

    //     const { children } = category;
    //     const quotas_tmp = children.map(child => Number(child.calcQuota(quota)));
    //     const difference = quota - quotas_tmp.reduce((accumulator, quota) => accumulator + quota, 0);

    //     const quotas = difference !== 0
    //             ? quotas_tmp.reverse()
    //                 .map((quota, index) => index === quotas_tmp.slice().reverse().findIndex(q => q !== 0) ? quota + difference : quota)
    //                 .reverse()
    //             : quotas_tmp;

    //     node.children = children
    //             ? children.map((child, index) => CategoryNode.createCategoryNode(child, node, quotas[index], expanded))
    //             : [];
        
    //     return node;
    // }

    // static createRootNode(category, quota, expanded) {
    //     const node = CategoryNode.createCategoryNode(category, null, quota, expanded);
    //     node.type = NodeType.Root;
    //     node.className = CategoryNode.getClassName(NodeType.Root, category);
    //     return node;
    // }

    // createInsertNode() {
    //     const node = new CategoryNode();
    //     node.type = NodeType.Insert;
    //     node.className = CategoryNode.getClassName(NodeType.Insert, this.category);
    //     node.parentNode = this;
    //     return node;
    // }

    // createInsertNodes() {
    //     if (this.category.level < 4
    //             && (this.children.length === 0
    //                 || this.children.every(child => child.type === NodeType.Category))) {
    //         this.children.forEach(child => child.createInsertNodes());
    //         this.children = [...this.children, this.createInsertNode()];
    //     }
    // }
    
    // clearInsertNodes() {
    //     this.children = this.children.filter(child => child.type != NodeType.Insert);
    //     this.children.forEach(child => child.clearInsertNodes());
    // }

    // insertNewCategoryNode() {
    //     const childNode = new CategoryNode();
    //     childNode.parentNode = this;
    //     childNode.type = NodeType.UpdateCategory;
    //     // childNode.category = this.category.createChildCategory();
    //     childNode.className = CategoryNode.getClassName(NodeType.Category, childNode.category);
    //     this.children.splice(this.children.length - 1, 0, childNode);
    // }

    setType(type) {
        this.type = type;
    }

    setPercentage(percentage) {
        this.percentage = percentage;
    }

    setCategory(category) {
        this.category = {
            ...category,
            count_pages: (category.count_pages || 0) + (this.children.reduce((total, child) => (
                total + (child.category.count_pages || 0)), 0) as number),
            count_documents: (category.count_documents || 0 )+ (this.children.reduce((total, child) => (
                total + (child.category.count_documents || 0)), 0) as number),
            count_documents_with_pages: (category.count_documents_with_pages || 0) + (this.children.reduce((total, child) => (
                total + (child.category.count_documents_with_pages || 0)), 0) as number),
        };
    }

    setName(name: string) {
        this.category = {
            ...this.category,
            name: name
        }
    }

    setDescription(description: string) {
        this.category = {
            ...this.category,
            description: description
        }
    }

    setAssignable(assignable: boolean) {
        this.category = {
            ...this.category,
            assignable: assignable
        }
    }

    deleteChild(node: CategoryNode) {
        this.children = this.children.filter(child => child !== node);
        this.category.children = this.category.children.filter(child => child.id !== node.category.id);
    }

    find(node) {
        if (this.category.id === node.category.id) {
            return this;
        }
        for (const child of this.children) {
            const result = child.find(node);
            if (result) {
                return result;
            }
        }
        return null;
    }
}
