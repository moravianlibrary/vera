import { CategoryPath } from "../../adapters/ApiDocuments";

function createCategoryPathLabel(path: CategoryPath) {
    return path.map((x) => x.category_name).join(" > ");
}

export { createCategoryPathLabel };
