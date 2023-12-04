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
        category.children = json.children ? json.children.map(child => this.fromJson(child)) : [];
        category.count_pages = json.count_pages
                + category.children.reduce((accumulator, category) => {
                    return accumulator + category.count_pages;
                }, 0);
        category.count_documents_with_pages = json.count_documents_with_pages
                + category.children.reduce((accumulator, category) => {
                    return accumulator + category.count_documents_with_pages;
                }, 0);
        category.count_documents = json.count_documents
                + category.children.reduce((accumulator, category) => {
                    return accumulator + category.count_documents;
                }, 0);

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

    isEmpty() {
        return this.count_documents == 0 && this.percentage == 0;
    }

    createUpdateClone(values) {
        const category = new Category();

        category.id = this.id;
        category.name = values.name;
        category.description = values.description;
        category.parent_id = this.parent_id;
        category.assignable = values.assignable;
        category.disabled = this.disabled;
        category.departments = values.departments;

        return category;
    }

    update(values) {
        this.name = values.name;
        this.description = values.description;
        this.parent_id = values.parent_id;
        this.assignable = values.assignable;
        this.disabled = values.disabled;
        this.departments = values.departments;
    }

    calcQuota(parent_quota) {
        return ((parent_quota * this.percentage) / 100).toFixed(0);
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

    createChildCategory() {
        const category = new Category();

        category.parent_id = this.id;
        category.level = this.level + 1;
        category.assignable = false;
        category.percentage = 0;
        category.disabled = false;
        category.departments = this.departments;
        category.children = [];

        return category;
    }
};