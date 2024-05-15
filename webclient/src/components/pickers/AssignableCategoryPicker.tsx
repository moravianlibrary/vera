import AssignableCategoryModel from "../../contexts/categories/AssignableCategoryModel";
import {
    TreeSelect,
    TreeSelectProps,
    TreeSelectSelectionKeysType,
} from "primereact/treeselect";
import React, { useEffect, useState } from "react";
import { useAssignableCategories } from "../../contexts/categories/AssignableCategoriesContext";
import { TreeNode } from "primereact/treenode";

interface AssignableCategoriesPickerProps {
    categories_ids: number[];
    callback(categories_ids: number[]): void;
    className?: string;
}

interface AssignableCategoryPickerProps {
    category_id: number | null;
    callback(category_id: number | null): void;
}

export const AssignableCategoriesPicker: React.FC<
    AssignableCategoriesPickerProps
> = ({ categories_ids, callback, className }) => {
    const { categories } = useAssignableCategories();

    const categoriesOptions = buildAssignableCategoriesOptionsTree(categories);
    const [selected, setSelected] =
        useState<TreeSelectSelectionKeysType | null>(null);

    useEffect(() => {
        if (categories_ids && categories_ids.length > 0) {
            const newSelected = {};
            categories
                .filter((c) => categories_ids.includes(c.id))
                .forEach((c) => {
                    newSelected[c.id.toString()] = true;
                });
            setSelected(newSelected);
        } else {
            setSelected({});
        }
    }, [categories_ids]);

    const handleChange = (event) => {
        if (!event.value) {
            return callback([]);
        }
        callback(Object.keys(event.value).map(Number));
    };

    return (
        <TreeSelect
            className={`${className ? className : ""}`}
            value={selected}
            display="chip"
            selectionMode="multiple"
            metaKeySelection={false}
            options={categoriesOptions}
            onChange={handleChange}
            filter
            showClear
        />
    );
};

const AssignableCategoryPicker: React.FC<AssignableCategoryPickerProps> = ({
    category_id,
    callback,
}) => {
    const { categories } = useAssignableCategories();
    console.log(categories);

    const categoriesOptions = buildAssignableCategoriesOptionsTree(categories);
    const selected = categories.find((c) => c.id === category_id);

    return (
        <TreeSelect
            value={selected ? selected.id.toString() : null}
            valueTemplate={(nodes, props) => (
                <AssignableCategoryPickerValues nodes={nodes} props={props} />
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

interface AssignableCategoryPickerValuesProps {
    nodes: TreeNode | TreeNode[];
    props: TreeSelectProps;
}

const AssignableCategoryPickerValues: React.FC<
    AssignableCategoryPickerValuesProps
> = ({ nodes, props }) => {
    if (Array.isArray(nodes)) {
        return nodes.length > 0 ? (
            <span>{nodes.map((n) => n.data).join(", ")}</span>
        ) : props.emptyMessage ? (
            <span>{props.emptyMessage}</span>
        ) : (
            <span>-</span>
        );
    }
    return <span>{nodes.data}</span>;
};

export interface CategoryOption {
    key: number;
    label: string;
    data?: string;
    children?: CategoryOption[];
    selectable: boolean;
}

// TODO: refactor into 2 functions
export function buildAssignableCategoriesOptionsTree(
    categories: AssignableCategoryModel[]
): CategoryOption[] {
    const categoryMap = new Map<number, AssignableCategoryModel>();
    const childrenMap = new Map<number, AssignableCategoryModel[]>();
    const rootCategories: AssignableCategoryModel[] = [];

    const flattenCategory = (category: AssignableCategoryModel) => {
        categoryMap.set(category.id, category);
        if (category.parent_category) {
            if (!childrenMap.has(category.parent_category.id)) {
                childrenMap.set(category.parent_category.id, []);
                flattenCategory(category.parent_category);
            }
            childrenMap.get(category.parent_category.id)?.push(category);
        } else {
            rootCategories.push(category);
        }
    };
    categories.forEach((c) => flattenCategory(c));

    const buildCategorySubTree = (category: AssignableCategoryModel) => {
        const children = childrenMap.get(category.id);
        if (!children) {
            return {
                key: category.id,
                label: category.name,
                data: category.getPath(),
                selectable: true,
            };
        }
        return {
            key: category.id,
            label: category.name,
            children: children.map((c) => buildCategorySubTree(c)),
            selectable: false,
        };
    };

    return rootCategories.map((c) => buildCategorySubTree(c));
}

export default AssignableCategoryPicker;
