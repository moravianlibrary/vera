import React, { useEffect, useState } from "react";
import { FacetViewProps } from "@elastic/react-search-ui-views";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { Fieldset } from "primereact/fieldset";
import { FieldValue } from "@elastic/search-ui";
import DigitizationStateTag from "../../../components/tags/DigitizationStateTag";
import { DigitizationState } from "../../../types/DigitizationState";
import { EsFilterView } from "./EsFilterView";
import { useDigitizationLists } from "../../../contexts/extractions/DigitizationListsContext";
import { MultiSelect, MultiSelectChangeEvent } from "primereact/multiselect";
import { DigitizationExtraction } from "../../../adapters/ApiDigitizationExtractions";
import { SelectItemOptionsType } from "primereact/selectitem";
import { useCategories } from "../../../contexts/categories/CategoriesContext";
import { Category } from "../../../adapters/ApiCategories";
import { useTranslation } from "react-i18next";
import {
    TreeSelect,
    TreeSelectChangeEvent,
    TreeSelectSelectionKeysType,
} from "primereact/treeselect";
import { CategoryOption } from "../../../components/pickers/AssignableCategoryPicker";
import { TreeNode } from "primereact/treenode";

interface CustomFacetViewProps extends FacetViewProps {
    onDisplayValue: (value: FieldValue) => React.ReactNode;
}

const CustomFacetView: React.FC<CustomFacetViewProps> = ({
    label,
    options,
    onSelect,
    onRemove,
    onDisplayValue,
}) => {
    const [selectedValues, setSelectedValues] = useState<FieldValue[]>([]);

    useEffect(() => {
        const valuesToRemove = selectedValues.filter(
            (v) => !options.some((o) => o.value === v)
        );

        if (valuesToRemove.length === 0) return;

        valuesToRemove.forEach((v) => onRemove(v));
        setSelectedValues((prevSelectedValues) =>
            prevSelectedValues.filter((v) => !valuesToRemove.includes(v))
        );
    }, [options]);

    const handleChange = (e: CheckboxChangeEvent, value: FieldValue) => {
        if (e.target.checked) {
            onSelect(value);
            setSelectedValues([...selectedValues, value]);
        } else {
            onRemove(value);
            setSelectedValues(selectedValues.filter((v) => v !== value));
        }
    };

    return (
        <EsFilterView label={label}>
            {options.map((option) => (
                <div
                    key={option.value as string}
                    className={
                        option.selected
                            ? "es-facet-value es-active-facet-value"
                            : "es-facet-value"
                    }
                >
                    <div className="es-checkbox">
                        <Checkbox
                            className={`es-${option.value}-checkbox`}
                            inputId={`es-${label}-${option.value}-checkbox`}
                            value={option.value}
                            checked={option.selected || false}
                            onChange={(e) =>
                                handleChange(e, option.value as FieldValue)
                            }
                        />
                        {onDisplayValue(option.value as FieldValue)}
                    </div>
                    <span>{option.count}</span>
                </div>
            ))}
        </EsFilterView>
    );
};

const ListFacetView: React.FC<FacetViewProps> = (props) => {
    const getCheckboxLabel = (value: FieldValue) => {
        return (
            <label htmlFor={`es-${props.label}-${value}-checkbox`}>
                {value as FieldValue}
            </label>
        );
    };

    return <CustomFacetView {...props} onDisplayValue={getCheckboxLabel} />;
};

const BooleanFacetView: React.FC<FacetViewProps> = (props) => {
    const getCheckboxLabel = (value: FieldValue) => {
        return (
            <label htmlFor={`es-${props.label}-${value}-checkbox`}>
                {value ? "Yes" : "No"}
            </label>
        );
    };

    return (
        <CustomFacetView
            {...props}
            options={props.options.sort((a, b) => (a.value ? -1 : 1))}
            onDisplayValue={getCheckboxLabel}
        />
    );
};

const DigitizationStateFacetView: React.FC<FacetViewProps> = (props) => {
    return (
        <CustomFacetView
            {...props}
            onDisplayValue={(value) => (
                <DigitizationStateTag state={value as DigitizationState} />
            )}
        />
    );
};

interface CategoryFacetOption extends CategoryOption {
    count?: number;
}

const CategoryFacetView: React.FC<FacetViewProps> = (props) => {
    const { t } = useTranslation();
    const { getAssignableCategoriesTrees } = useCategories();
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
            const categoryFacet = props.options.find(
                (o) => o.value === category.id
            );
            return {
                key: category.id,
                label: category.name,
                data: currPath,
                count:
                    (categoryFacet ? categoryFacet.count : 0) +
                    children.reduce(
                        (sum, child) => sum + (child.count || 0),
                        0
                    ),
                children: children,
                selectable: category.assignable,
            };
        };

        return categories.map((c) => buildCategorySubTree(c));
    }

    const handleCategoryChange = (e: TreeSelectChangeEvent) => {
        if (!e.value) {
            Object.keys(selectedCategories).forEach((category_id) => {
                props.onRemove(Number(category_id));
            });
            setSelectedCategories({});
        } else {
            Object.keys(e.value as TreeSelectSelectionKeysType).forEach(
                (category_id) => props.onSelect(Number(category_id))
            );
            setSelectedCategories(e.value as TreeSelectSelectionKeysType);
        }
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

    return (
        <EsFilterView label={props.label}>
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
        </EsFilterView>
    );
};

interface DigitizationListCheckboxLabelProps {
    label: string;
    value: FieldValue;
}

const DigitizationListCheckboxLabel: React.FC<
    DigitizationListCheckboxLabelProps
> = ({ label, value }) => {
    const { findDigitizationList } = useDigitizationLists();

    const [valueLabel, setValueLabel] = useState<string>(`${value}`);

    useEffect(() => {
        const fetchLabel = async () => {
            try {
                const list = await findDigitizationList(value as number);
                setValueLabel(`${value}: ${list?.created_by}`);
            } catch (error) {
                setValueLabel(`${value}: [Error fetching list]`);
            }
        };

        fetchLabel();
    }, [value]);

    return (
        <label htmlFor={`es-${label}-${value}-checkbox`}>{valueLabel}</label>
    );
};

function transformToMultiSelectOptions(
    digitizationLists: DigitizationExtraction[]
): SelectItemOptionsType {
    return digitizationLists.map((list) => ({
        label: `${list.id}: ${list.created_by}, ${list.created_at}, ${list.page_count} pages`,
        value: list.id,
    }));
}

const DigitizationListFacetView: React.FC<FacetViewProps> = (props) => {
    return (
        <CustomFacetView
            {...props}
            onDisplayValue={(value) => (
                <DigitizationListCheckboxLabel
                    label={props.label}
                    value={value}
                />
            )}
        />
    );
};

export {
    ListFacetView,
    BooleanFacetView,
    DigitizationStateFacetView,
    CategoryFacetView,
    DigitizationListFacetView,
};
