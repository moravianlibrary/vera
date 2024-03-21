import AssignableCategoryModel from "../../contexts/categories/AssignableCategoryModel";
import { TreeSelect, TreeSelectProps } from "primereact/treeselect";
import React from "react";
import { TreeNode } from "primereact/treenode";
import { useCategories } from "../../contexts/categories/CategoriesContext";
import { Category } from "../../adapters/ApiCategories";

interface CategoryPickerProps {
    category_id: number | null;
    callback(category_id: number | null): void;
    className?: string;
}

const CategoryPicker: React.FC<CategoryPickerProps> = ({
    category_id,
    callback,
    className,
}) => {
    const { categories } = useCategories();

    const categoriesOptions = categories ? buildCategoryTree(categories) : [];
    const selected = category_id
        ? findCategoryById(categories ? categories : [], category_id)
        : null;

    return (
        <TreeSelect
            className={`${className ? className : ""} w-full`}
            value={selected ? selected.id.toString() : null}
            valueTemplate={(nodes, props) => (
                <CategoryPickerValues nodes={nodes} props={props} />
            )}
            options={categoriesOptions}
            onChange={(e) =>
                callback(e.value ? parseInt(e.value as string) : null)
            }
            filter
            showClear
        />
    );
};

interface CategoryPickerValuesProps {
    nodes: TreeNode | TreeNode[];
    props: TreeSelectProps;
}

const CategoryPickerValues: React.FC<CategoryPickerValuesProps> = ({
    nodes,
    props,
}) => {
    if (Array.isArray(nodes)) {
        return nodes.length > 0 ? (
            <span>{nodes.map((n) => n.data).join(", ")}</span>
        ) : props.emptyMessage ? (
            <span className="text-overflow-ellipsis white-space-nowrap">
                {props.emptyMessage}
            </span>
        ) : (
            <span>-</span>
        );
    }
    return <span>{nodes.data}</span>;
};

function buildCategoryTree(categories: Category[]) {
    return categories.map((category) => {
        return {
            key: category.id,
            label: category.name,
            data: category.name,
            children: buildCategoryTree(category.children),
        };
    });
}

function findCategoryById(categories: Category[], id: number) {
    for (const category of categories) {
        if (category.id === id) {
            return category;
        }
        const foundInChildren = findCategoryById(category.children, id);
        if (foundInChildren) {
            return foundInChildren;
        }
    }
    return null;
}

export default CategoryPicker;
