import {
    TreeSelect,
    TreeSelectProps,
    TreeSelectSelectionKeysType,
} from "primereact/treeselect";
import React, { useEffect, useState } from "react";
import { TreeNode } from "primereact/treenode";
import { useCategories } from "../../contexts/categories/CategoriesContext";
import { Category } from "../../adapters/ApiCategories";

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
    const { getAssignableCategoriesTrees } = useCategories();

    const categories = getAssignableCategoriesTrees();
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
    const { getAssignableCategoriesTrees } = useCategories();

    const categories = getAssignableCategoriesTrees();
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
            <span>{props.emptyMessage as string}</span>
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

export function buildAssignableCategoriesOptionsTree(
    categories: Category[]
): CategoryOption[] {
    const buildCategorySubTree = (category: Category, path: string = "") => {
        const currPath =
            path === "" ? category.name : path + " > " + category.name;
        return {
            key: category.id,
            label: category.name,
            data: currPath,
            children: category.sub_categories.map((c) =>
                buildCategorySubTree(c, currPath)
            ),
            selectable: category.assignable,
        };
    };

    return categories.map((c) => buildCategorySubTree(c));
}

export default AssignableCategoryPicker;
