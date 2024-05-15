import { Category, CreateCategory, Quota } from "../../adapters/ApiCategories";
import { CategoryType } from "./CategoryType";

export class CategoryModel implements Category {
    id: number;
    level: number;
    sub_categories: Category[];
    name: string;
    description: string | null;
    parent_id: number | null;
    assignable: boolean;
    disabled: boolean;
    departments: number[];

    key: number;
    type: CategoryType;
    quota: number;
    percentage: number;
    overallPercentage: number;

    parent: CategoryModel | undefined;
    children: CategoryModel[] = [];

    extracted_pages_count: number = 0;
    extracted_documents_count: number = 0;

    predecessors_departments: number[] = [];
    count_pages: number = 0;
    count_pages_extractable: number = 0;
    count_documents: number = 0;
    count_documents_with_pages: number = 0;
    count_documents_extractable: number = 0;
    count_documents_without_cnb: number = 0;

    className = 'category';
    expanded: boolean = true;
    style = { borderRadius: '12px' };

    constructor(type: CategoryType, category: Category, quota: number, parent?: CategoryModel) {
        Object.assign(this, category);

        this.key = category.id;
        this.type = type;
        this.quota = quota;
        this.percentage = category.percentage;
        this.overallPercentage = category.percentage;

        this.parent = parent;
        this.className = CategoryModel.getClassName(type, category);

        if (parent && (parent.predecessors_departments.length > 0
                || parent.departments.length > 0)) {
            this.predecessors_departments = Array.from(new Set([
                ...parent.predecessors_departments,
                ...parent.departments,
                ...this.departments
            ])).sort();
        }

        if (type !== CategoryType.LevelRoot) {
            const childrenQuotas = CategoryModel.getChildrenQuotas(category.sub_categories, quota);
            this.children = category.sub_categories.map((child, index) => (
                new CategoryModel(CategoryType.Category, child, childrenQuotas[index], this)))
                .sort((a, b) => a.key - b.key);
            // this.aggregateStats(quota, parent ? parent.overallPercentage : 100);
        }
    }

    static generateRootNode(name: string, categories: Category[], quota: number): CategoryModel {
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
            
            sub_categories: categories
        }
        const rootNode = new CategoryModel(CategoryType.Root, rootCategory, quota);
        rootNode.aggregateStats(quota, 100);
        return rootNode;
    }

    static generateLevelRootNode(name: string, childNodes: CategoryModel[]): CategoryModel {
        const levelRootNode = new CategoryModel(CategoryType.LevelRoot, {
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
            
            sub_categories: []
        }, childNodes.reduce((total, child) => total + child.quota, 0));

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

    static getClassName(type: CategoryType, category?: Category): string {
        if (category === undefined) {
            return '';
        }
        if (type === CategoryType.Root || type === CategoryType.LevelRoot) {
            return 'category-root';
        }
        if (category.disabled) {
            return 'category-disabled';
        }
        switch (category.level) {
            case 0: return category.assignable ? 'category-assignable-0' : 'category-0';
            case 1: return category.assignable ? 'category-assignable-1' : 'category-1';
            case 2: return category.assignable ? 'category-assignable-2' : 'category-2';
            case 3: return category.assignable ? 'category-assignable-3' : 'category-3';
        }
        return '';
    }

    static getChildrenQuotas(sub_categories: Category[], quota: number) {
        const quotas_tmp: number[] = sub_categories.map(child => {
            return Math.floor((quota * (child.percentage || 0)) / 100);
        });
        const difference = quota - quotas_tmp.reduce((accumulator, quota) => accumulator + quota, 0);

        return difference !== 0
                ? quotas_tmp.reverse()
                    .map((quota, index) => index === quotas_tmp.slice().reverse().findIndex(q => q !== 0) ? quota + difference : quota)
                    .reverse()
                : quotas_tmp;
    }

    insertChildNode(): CategoryModel {
        const newCategory: Category = {
            id: this.sub_categories.reduce((total, child) => total + child.id, 0),
            name: "",
            description: null,
            parent_id: this.id,

            assignable: false,
            disabled: false,
            departments: this.departments,

            percentage: 0,
            level: this.level + 1,

            count_pages: 0,
            count_pages_extractable: 0,
            count_documents: 0,
            count_documents_with_pages: 0,
            count_documents_extractable: 0,
            count_documents_without_cnb: 0,
            
            sub_categories: []
        };
        const newNode = new CategoryModel(CategoryType.NewCategory, newCategory, 0, this);
        this.children = [...this.children, newNode];
        return newNode;
    }

    addCategory(category: Category) {
        this.sub_categories = [...this.sub_categories, category];
    }

    updateChildren(sub_categories: Category[]) {
        sub_categories.forEach(child => {
            const childModel = this.children.find(c => c.id === child.id);
            if (childModel) {
                childModel.update(child);
            }
        })
    }

    update(category: Category) {
        Object.assign(this, category);
        this.updateChildren(category.sub_categories);
    }

    aggregateStats(quotaPagesCount: number, overallPercentage: number) {
        this.quota = quotaPagesCount;
        this.overallPercentage = overallPercentage;

        if (this.assignable) {
            return;
        }

        const childrenQuotas = CategoryModel.getChildrenQuotas(this.children, quotaPagesCount);
        this.children.forEach((child, index) => child.aggregateStats(childrenQuotas[index], (overallPercentage * child.percentage) / 100));

        this.count_pages = this.children.reduce((total, child) => (
            total + (child.count_pages || 0)), 0) as number;
        this.count_pages_extractable = this.children.reduce((total, child) => (
            total + (child.count_pages_extractable || 0)), 0) as number;

        this.count_documents = this.children.reduce((total, child) => (
            total + (child.count_documents || 0)), 0) as number;
        this.count_documents_with_pages = this.children.reduce((total, child) => (
            total + (child.count_documents_with_pages || 0)), 0) as number;
        this.count_documents_extractable = this.children.reduce((total, child) => (
            total + (child.count_documents_extractable || 0)), 0) as number;
        this.count_documents_without_cnb = this.children.reduce((total, child) => (
            total + (child.count_documents_without_cnb || 0)), 0) as number;

        this.extracted_pages_count = this.children.reduce((total, child) => (
            total + (child.extracted_pages_count || 0)), 0) as number;
        this.extracted_documents_count = this.children.reduce((total, child) => (
            total + (child.extracted_documents_count || 0)), 0) as number;
    }

    propagateDepartments(departments: number[] = []) {
        this.predecessors_departments = Array.from(new Set([...departments, ...this.departments])).sort();
        this.children.forEach(child => child.propagateDepartments(this.predecessors_departments))
    }

    setType(type) {
        this.type = type;
    }

    setPercentage(percentage) {
        this.percentage = percentage;
    }

    setCategory(category) {
        if (this.departments !== category.departments) {
            this.children.forEach(child => child.propagateDepartments(category.departments));
        }
        Object.assign(this, category);
        this.className = CategoryModel.getClassName(this.type, category);
        
    }

    setName(name: string) {
        this.name = name;
    }

    setDescription(description: string) {
        this.description = description;
    }

    setAssignable(assignable: boolean) {
        this.assignable = assignable;
    }

    deleteChild(categoryId: number) {
        this.children = this.children.filter(child => child.id !== categoryId);
        this.sub_categories = this.sub_categories.filter(child => child.id !== categoryId);
    }

    find(category) {
        if (this.id === category.id) {
            return this;
        }
        for (const child of this.children) {
            const result = child.find(category);
            if (result) {
                return result;
            }
        }
        return null;
    }

    getCategoryModelById(id: number): CategoryModel | null {
        if (this.id === id) {
            return this;
        }
        for (const child of this.children) {
            const result = child.getCategoryModelById(id);
            if (result) {
                return result;
            }
        }
        return null;
    }

    getNodesByLevel(level: number): CategoryModel[] {
        if (this.level === level) {
            return [this];
        }
        const nodes: CategoryModel[] = [];
        for (const child of this.children) {
            nodes.push(...child.getNodesByLevel(level));
        }
        return nodes;
    }

    getAssignableCategoryModels(): CategoryModel[] {
        const nodes: CategoryModel[] = [];
        if (this.assignable) {
            nodes.push(this);
        }
        for (const child of this.children) {
            nodes.push(...child.getAssignableCategoryModels());
        }
        return nodes;
    }
}
