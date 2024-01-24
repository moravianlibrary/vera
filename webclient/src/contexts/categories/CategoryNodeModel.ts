import { Category, CreateCategory, Quota } from "../../adapters/ApiCategories";
import { NodeType } from "./CategoryNodeType";

export class CategoryNode {
    type: NodeType;
    category: Category;
    quota: number;
    percentage: number | undefined;
    parentNode: CategoryNode | undefined;
    children: CategoryNode[] = [];

    count_pages: number = 0;
    count_documents_with_pages: number = 0;
    count_documents: number = 0;

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
        this.aggregateStats();
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

            count_pages: 0,
            count_documents_with_pages: 0,
            count_documents: 0,
            
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

    updateChildren(children: Category[], quotaPagesCount: number) {
        const childrenQuotas = CategoryNode.getChildrenQuotas(children, quotaPagesCount);
        this.children.forEach((child, index) => (
            child.updateChildren(children[index].children, childrenQuotas[index])));

        this.aggregateStats();
        this.quota = quotaPagesCount;
    }

    aggregateStats() {
        this.count_pages = (this.category.count_pages || 0) + (this.children.reduce((total, child) => (
            total + (child.count_pages || 0)), 0) as number);
        this.count_documents = (this.category.count_documents || 0 )+ (this.children.reduce((total, child) => (
            total + (child.count_documents || 0)), 0) as number);
        this.count_documents_with_pages = (this.category.count_documents_with_pages || 0) + (this.children.reduce((total, child) => (
            total + (child.count_documents_with_pages || 0)), 0) as number);
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
