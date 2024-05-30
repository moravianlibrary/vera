import { Category } from "../../adapters/ApiCategories";
import { CategoryType } from "./CategoryType";

export class CategoryModel implements Category {
    id: number;

    name: string;
    description: string | null;

    parent_id: number | null;
    level: number;

    assignable: boolean;
    extract_whole: boolean;
    disabled: boolean;

    predecessors_departments: number[] = [];
    departments: number[];

    total_pages: number;
    total_documents: number;

    documents_with_pages: number;
    documents_without_cnb: number;

    extractable_pages: number;
    extractable_documents: number;

    intention_id?: number | undefined;
    percentage?: number;
    overall_percentage?: number;
    pages_needed_to_meet_intention?: number | undefined;

    extraction_id?: number | undefined;
    extracted_pages?: number | undefined;
    extracted_documents?: number | undefined;

    digitization_ids?: number[] | undefined;
    digitized_pages?: number | undefined;
    digitized_documents?: number | undefined;

    sub_categories: Category[];

    key: number;
    type: CategoryType;

    parent: CategoryModel | undefined;
    children: CategoryModel[] = [];

    className = 'category';
    expanded: boolean = true;
    style = { borderRadius: '12px' };

    constructor(type: CategoryType, category: Category, parent?: CategoryModel) {
        Object.assign(this, category);

        this.key = category.id;
        this.type = type;

        this.parent = parent;
        this.className = CategoryModel.getClassName(type, category);

        // if (type !== CategoryType.LevelRoot) {
            this.children = category.sub_categories
            .filter((sub_category) => sub_category.intention_id)
            .map((sub_category) => (
                new CategoryModel(CategoryType.Category, sub_category, this)));
        // }
    }

    static generateCategory(id: number, name: string = "", level: number = -1, categories: Category[] = []): Category{
        return {
            id: id,

            name: name,
            description: null,

            parent_id: null,
            level: level,

            assignable: false,
            extract_whole: false,
            disabled: false,

            departments: [],
            predecessors_departments: [],

            total_pages: categories.reduce((sum, category) => sum + category.total_pages, 0),
            total_documents: categories.reduce((sum, category) => sum + category.total_documents, 0),
            documents_with_pages: categories.reduce((sum, category) => sum + category.documents_with_pages, 0),
            documents_without_cnb: categories.reduce((sum, category) => sum + category.documents_without_cnb, 0),
            extractable_pages: categories.reduce((sum, category) => sum + category.extractable_pages, 0),
            extractable_documents: categories.reduce((sum, category) => sum + category.extractable_documents, 0),
                    
            sub_categories: categories
        }
    }

    static generateRootNode(rootType: CategoryType.Root | CategoryType.LevelRoot, name: string, categories: Category[]): CategoryModel {
        const rootCategory: Category = CategoryModel.generateCategory(0, name, -1, categories);
        if (categories.length > 0) {
            if (categories[0].intention_id) {
                rootCategory.intention_id = categories[0].intention_id;
                rootCategory.percentage = 100;
                rootCategory.overall_percentage = categories.reduce((sum, category) => sum + category.overall_percentage!, 0);
                rootCategory.pages_needed_to_meet_intention = categories.reduce((sum, category) => sum + category.pages_needed_to_meet_intention!, 0);
            }
            if (categories[0].extraction_id) {
                rootCategory.extraction_id = categories[0].extraction_id;
                rootCategory.extracted_pages = categories.reduce((sum, category) => sum + category.extracted_pages!, 0);
                rootCategory.extracted_documents = categories.reduce((sum, category) => sum + category.extracted_documents!, 0);
            }
            if (categories[0].digitization_ids) {
                rootCategory.digitization_ids = categories[0].digitization_ids;
                rootCategory.digitized_pages = categories.reduce((sum, category) => sum + category.digitized_pages!, 0);
                rootCategory.digitized_documents = categories.reduce((sum, category) => sum + category.digitized_documents!, 0);
            }
        }
        return new CategoryModel(rootType, rootCategory);
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

    insertChildNode(): CategoryModel {
        const newCategory: Category = CategoryModel.generateCategory(-2, "", this.level + 1);
        const newNode = new CategoryModel(CategoryType.NewCategory, newCategory, this);
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

    setType(type) {
        this.type = type;
    }

    setPercentage(percentage) {
        this.percentage = percentage;
    }

    setCategory(category) {
        Object.assign(this, category);
        this.className = CategoryModel.getClassName(this.type, category);
        this.children = category.sub_categories.map((sub_category) => (
            new CategoryModel(CategoryType.Category, sub_category, this)));
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

    getNodesByLevel(level: number): Category[] {
        if (this.level === level) {
            return [this];
        }
        const nodes: Category[] = [];
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

    getPath() {
        if (this.parent) {
            return `${this.parent.getPath()} > ${this.name}`;
        }
        return this.name;
    }
}
