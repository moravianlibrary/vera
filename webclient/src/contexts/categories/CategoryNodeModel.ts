import { Category, CreateCategory, Quota } from "../../adapters/ApiCategories";
import { NodeType } from "./CategoryNodeType";

export class CategoryNode {
    type: NodeType;
    category: Category;
    quota: number;
    percentage: number | undefined;
    overallPercentage: number;
    parentNode: CategoryNode | undefined;
    children: CategoryNode[] = [];

    extracted: boolean;
    extracted_pages_count: number = 0;
    extracted_documents_count: number = 0;

    predecessors_departments: number[] = [];
    count_pages: number = 0;
    count_pages_extractable: number = 0;
    count_documents: number = 0;
    count_documents_with_pages: number = 0;
    count_documents_extractable: number = 0;
    count_documents_without_cnb: number = 0;

    className = 'bg-yellow-500';
    expanded: boolean = true;
    style = { borderRadius: '12px' };

    constructor(type: NodeType, category: Category, quota: number, extracted: boolean, parentNode?: CategoryNode) {
        this.type = type;
        this.category = category;
        this.quota = quota;
        this.parentNode = parentNode;
        this.percentage = category.percentage;
        this.overallPercentage = category.percentage;
        this.className = CategoryNode.getClassName(type, category);
        this.extracted = extracted;

        if (parentNode && (parentNode.predecessors_departments.length > 0
                || parentNode.category.departments.length > 0)) {
            this.predecessors_departments = Array.from(new Set([
                ...parentNode.predecessors_departments,
                ...parentNode.category.departments,
                ...this.category.departments
            ])).sort();
        }

        if (type !== NodeType.LevelRoot) {
            const childrenQuotas = CategoryNode.getChildrenQuotas(category.children, quota);
            this.children = category.children.map((child, index) => (
                new CategoryNode(NodeType.Category, child, childrenQuotas[index], extracted, this)))
                .sort((a, b) => a.category.id - b.category.id);
            // this.aggregateStats(quota, parentNode ? parentNode.overallPercentage : 100);
        }
    }

    static generateRootNode(name: string, categories: Category[], quota: number, extracted: boolean): CategoryNode {
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
            count_pages_extractable: 0,
            count_documents: 0,
            count_documents_with_pages: 0,
            count_documents_extractable: 0,
            count_documents_without_cnb: 0,
            
            children: categories
        }
        const rootNode = new CategoryNode(NodeType.Root, rootCategory, quota, extracted);
        rootNode.aggregateStats(quota, 100);
        return rootNode;
    }

    static generateLevelRootNode(name: string, childNodes: CategoryNode[], extracted: boolean): CategoryNode {
        const levelRootNode = new CategoryNode(NodeType.LevelRoot, {
            id: -1,
            name: name,
            description: null,
            parent_id: null,

            assignable: false,
            disabled: false,
            departments: [],

            percentage: 100,
            level: -1,

            count_pages: 0,
            count_pages_extractable: 0,
            count_documents: 0,
            count_documents_with_pages: 0,
            count_documents_extractable: 0,
            count_documents_without_cnb: 0,
            
            children: []
        }, childNodes.reduce((total, child) => total + child.quota, 0), extracted);

        levelRootNode.children = childNodes;
        levelRootNode.count_pages = childNodes.reduce((total, child) => total + child.count_pages, 0);
        levelRootNode.count_pages_extractable = childNodes.reduce((total, child) => total + child.count_pages_extractable, 0);
        levelRootNode.count_documents = childNodes.reduce((total, child) => total + child.count_documents, 0);
        levelRootNode.count_documents_with_pages = childNodes.reduce((total, child) => total + child.count_documents_with_pages, 0);
        levelRootNode.count_documents_extractable = childNodes.reduce((total, child) => total + child.count_documents_extractable, 0);
        levelRootNode.count_documents_without_cnb = childNodes.reduce((total, child) => total + child.count_documents_without_cnb, 0);
        levelRootNode.extracted_pages_count = childNodes.reduce((total, child) => total + child.extracted_pages_count, 0);
        levelRootNode.extracted_documents_count = childNodes.reduce((total, child) => total + child.extracted_documents_count, 0);
        return levelRootNode;
    }

    static getClassName(type: NodeType, category?: Category): string {
        if (type === NodeType.Root || type === NodeType.LevelRoot) {
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
            count_pages_extractable: 0,
            count_documents: 0,
            count_documents_with_pages: 0,
            count_documents_extractable: 0,
            count_documents_without_cnb: 0,
            
            children: []
        };
        const newNode = new CategoryNode(NodeType.CreateCategory, newCategory, 0, false, this);
        this.children = [...this.children, newNode];
    }

    updateChildren(children: Category[]) {
        children.forEach(child => {
            const node = this.children.find(c => c.category.id === child.id);
            if (node) {
                node.update(child);
            }
        })
    }

    update(category: Category) {
        this.category = category;
        this.updateChildren(category.children);
    }

    aggregateStats(quotaPagesCount: number, overallPercentage: number) {
        const childrenQuotas = CategoryNode.getChildrenQuotas(this.children.map(c => c.category), quotaPagesCount);
        this.children.forEach((child, index) => child.aggregateStats(childrenQuotas[index], (overallPercentage * child.category.percentage) / 100));

        this.count_pages = (this.category.count_pages || 0) + (this.children.reduce((total, child) => (
            total + (child.count_pages || 0)), 0) as number);
        this.count_pages_extractable = (this.category.count_pages_extractable || 0) + (this.children.reduce((total, child) => (
            total + (child.count_pages_extractable || 0)), 0) as number);

        this.count_documents = (this.category.count_documents || 0 ) + (this.children.reduce((total, child) => (
            total + (child.count_documents || 0)), 0) as number);
        this.count_documents_with_pages = (this.category.count_documents_with_pages || 0) + (this.children.reduce((total, child) => (
            total + (child.count_documents_with_pages || 0)), 0) as number);
        this.count_documents_extractable = (this.category.count_documents_extractable || 0) + (this.children.reduce((total, child) => (
            total + (child.count_documents_extractable || 0)), 0) as number);
        this.count_documents_without_cnb = (this.category.count_documents_without_cnb || 0 ) + (this.children.reduce((total, child) => (
            total + (child.count_documents_without_cnb || 0)), 0) as number);

        this.extracted_pages_count = (this.category.extracted_pages_count || 0) + (this.children.reduce((total, child) => (
            total + (child.extracted_pages_count || 0)), 0) as number);
        this.extracted_documents_count = (this.category.extracted_documents_count || 0) + (this.children.reduce((total, child) => (
            total + (child.extracted_documents_count || 0)), 0) as number);

        this.quota = quotaPagesCount;
        this.overallPercentage = overallPercentage;
    }

    propagateDepartments(departments: number[] = []) {
        this.predecessors_departments = Array.from(new Set([...departments, ...this.category.departments])).sort();
        this.children.forEach(child => child.propagateDepartments(this.predecessors_departments))
    }

    setType(type) {
        this.type = type;
    }

    setPercentage(percentage) {
        this.percentage = percentage;
    }

    setCategory(category) {
        if (this.category.departments !== category.departments) {
            this.children.forEach(child => child.propagateDepartments(category.departments));
        }
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

    getCategoryNodeById(id: number): CategoryNode | null {
        if (this.category.id === id) {
            return this;
        }
        for (const child of this.children) {
            const result = child.getCategoryNodeById(id);
            if (result) {
                return result;
            }
        }
        return null;
    }

    getNodesByLevel(level: number): CategoryNode[] {
        if (this.category.level === level) {
            return [this];
        }
        const nodes: CategoryNode[] = [];
        for (const child of this.children) {
            nodes.push(...child.getNodesByLevel(level));
        }
        return nodes;
    }

    getAssignableCategoryNodes(): CategoryNode[] {
        const nodes: CategoryNode[] = [];
        if (this.category.assignable) {
            nodes.push(this);
        }
        for (const child of this.children) {
            nodes.push(...child.getAssignableCategoryNodes());
        }
        return nodes;
    }
}
