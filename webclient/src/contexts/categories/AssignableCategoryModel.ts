import { AssignableCategory } from "../../adapters/ApiCategories";

class AssignableCategoryModel implements AssignableCategory {
    id: number;
    name: string;
    description: string | null;
    parent_category?: AssignableCategoryModel | null;

    constructor(category: AssignableCategory) {
        this.id = category.id;
        this.name = category.name;
        this.description = category.description;
        this.parent_category = category.parent_category
                ? new AssignableCategoryModel(category.parent_category) : null;
    }

    getPath() {
        if (this.parent_category) {
            return `${this.parent_category.getPath()} > ${this.name}`;
        }
        return this.name;
    }
};

export default AssignableCategoryModel;
