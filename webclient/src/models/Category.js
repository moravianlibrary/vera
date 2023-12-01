export class Quota {
    id;
    name;
    description;
    pages_count;
    active;

    static fromJson(json) {
        const qouta= new Quota();

        qouta.id = json.id;
        qouta.name = json.name;
        qouta.description = json.description;
        qouta.pages_count = json.pages_count;
        qouta.active = json.active;

        return qouta;
    }
}

export class Category {
    id;
    name;
    description;
    parent_id;
    level;
    assignable;
    percentage;
    disabled;
    departments;

    children;
    count_pages;
    count_documents_with_pages;
    count_documents;

    static fromJson(json) {
        const category = new Category();

        category.id = json.id;
        category.name = json.name;
        category.description = json.description;
        category.parent_id = json.parent_id;
        category.level = json.level;
        category.assignable = json.assignable;
        category.percentage = json.percentage;
        category.disabled = json.disabled;
        category.departments = json.departments;
        category.children = json.children.map(child => this.fromJson(child));
        category.count_pages = json.count_pages;
        category.count_documents_with_pages = json.count_documents_with_pages;
        category.count_documents = json.count_documents;

        return category;
    }

    toJson() {
        return {
            name: this.name,
            description: this.description,
            parent_id: this.parent_id,
            assignable: this.assignable,
            disabled: this.disabled,
            departments: this.departments,
        };
    }

    calcQuota(parent_quota) {
        return ((parent_quota * this.percentage) / 100).toFixed(0);
    }

    setName(name) {
        this.name = name;
    }

    setPercentage(percentage) {
        this.percentage = percentage;
    }

    static createRootCategory(name, children = []) {
        const category = new Category();

        category.name = name;
        category.level = -1;
        category.assignable = false;
        category.percentage = 100;
        category.disabled = false;
        category.children = children;
        category.count_pages = children.reduce((accumulator, category) => {
            return accumulator + category.count_pages;
        }, 0);
        category.count_documents_with_pages = children.reduce((accumulator, category) => {
            return accumulator + category.count_documents_with_pages;
        }, 0);
        category.count_documents = children.reduce((accumulator, category) => {
            return accumulator + category.count_documents;
        }, 0);

        return category;
    }

    static createChildCategory(level) {
        const category = new Category();

        category.level = level;
        category.assignable = false;
        category.percentage = 0;
        category.disabled = false;
        category.children = [];

        return category;
    }
};