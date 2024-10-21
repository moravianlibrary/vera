import React, { useEffect, useState } from "react";
import { EsFacetProps } from "./EsFacet";
import EsFilter from "./EsFilter";
import {
    TreeSelect,
    TreeSelectChangeEvent,
    TreeSelectSelectionKeysType,
} from "primereact/treeselect";
import { CategoryOption } from "../../selects/AssignableCategoryPicker";
import { TreeNode } from "primereact/treenode";
import { useRefinementList } from "react-instantsearch";
import { useCategories } from "../../../contexts/categories/CategoriesContext";
import { Category } from "../../../adapters/ApiCategories";

interface CategoryFacetOption extends CategoryOption {
    count?: number;
}

const EsCategoryFacet: React.FC<EsFacetProps> = (props) => {
    const { items, refine } = useRefinementList(props);

    const { categories, getAssignableCategoriesTrees } = useCategories();
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [selectedCategories, setSelectedCategories] =
        useState<TreeSelectSelectionKeysType>({});

    function buildAssignableCategoriesOptionsTree(
        categories: Category[]
    ): CategoryFacetOption[] {
        const buildCategorySubTree = (
            category: Category,
            path: string = ""
        ) => {
            const currPath =
                path === "" ? category.name : path + " > " + category.name;
            const children = category.sub_categories.map((c) =>
                buildCategorySubTree(c, currPath)
            );
            const categoryFacet = items.find(
                (item) => Number(item.value) === category.id
            );
            return {
                key: category.id,
                label: category.name,
                data: currPath,
                count: categoryFacet ? categoryFacet.count : 0,
                children: children,
                selectable: true,
            };
        };

        return categories.map((c) => buildCategorySubTree(c));
    }

    const handleCategoryChange = (e: TreeSelectChangeEvent) => {
        const currentCategories = e.value
            ? Object.keys(e.value as TreeSelectSelectionKeysType)
            : [];
        const selected = Object.keys(selectedCategories);

        // Refine categories that have been removed
        selected
            .filter((c) => !currentCategories.includes(c))
            .forEach((c) => refine(c));
        // Refine categories that have been added
        currentCategories
            .filter((c) => !selected.includes(c))
            .forEach((c) => refine(c));

        setSelectedCategories((e.value as TreeSelectSelectionKeysType) || {});
    };

    const nodeView = (node: TreeNode) => {
        return (
            <div className="es-tree-select-facet">
                <div className="es-facet-value">
                    <span>{node.label} </span>
                    <span>{(node as CategoryFacetOption).count}</span>
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (!isInitialized) {
            setSelectedCategories(
                items
                    .filter((item) => item.isRefined)
                    .reduce((acc, item) => {
                        acc[item.value] = true;
                        return acc;
                    }, {} as TreeSelectSelectionKeysType)
            );
        }
    }, [items]);

    return (
        <EsFilter label={props.label}>
            <TreeSelect
                value={selectedCategories}
                display="chip"
                selectionMode="multiple"
                metaKeySelection={false}
                options={buildAssignableCategoriesOptionsTree(
                    getAssignableCategoriesTrees()
                )}
                onChange={handleCategoryChange}
                nodeTemplate={nodeView}
                filter
                showClear
            />
        </EsFilter>
    );
};

export default EsCategoryFacet;
