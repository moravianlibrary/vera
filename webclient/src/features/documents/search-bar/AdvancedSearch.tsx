import { Button } from "primereact/button";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchGroup } from "../../../contexts/documents/search/SearchNodes.js";
import AdvancedSearchNode from "./AdvancedSearchNode";
import DocumentField from "../../../documents/models/DocumentField.js";
import { useCategories } from "../../../contexts/categories/CategoriesContext";
import React from "react";
import { useDocumentsSearch } from "../../../contexts/documents/search/DocumentsSearch";

const FieldType = {
    TEXT: 'TEXT',
    NUMBER: 'NUMBER',
    CATEGORY: 'CATEGORY',
};

const AdvancedSearch = () => {
    const { t } = useTranslation();
    const { rootSearchNode } = useDocumentsSearch();
    const { categories } = useCategories();

    const enums = {
        [DocumentField.CATEGORY.name]: {
            values: categories,
            placeholder: t('choose_category')
        }
    };

    // const handleUpdateFilter = (data) => {
    //     setFilter(data);
    // }

    const handleClearFilters = () => {
        // if (props.onApplyFilter) {
        //     props.onApplyFilter(filter);
        // }
    };

    const handleApplyFilters = () => {
        // localStorage.setItem('advanced_search', JSON.stringify(filter.toJson()));
        console.log(rootSearchNode);
        // if (props.onApplyFilter) {
        //     props.onApplyFilter(filter);
        // }
    };

    useEffect(() => {
        // const activeFilter = SearchGroup.fromJson(JSON.parse(localStorage.getItem('advanced_search')));
        // if (activeFilter && !activeFilter.isEmpty()) {
        //     setFilter(activeFilter);
        // }
        console.log(rootSearchNode);
    }, [rootSearchNode]);

    return (
        <div className="flex flex-column gap-1 flex-grow-0">
            <div className="overflow-auto" style={{ 'maxHeight': '75vh' }}>
                <AdvancedSearchNode data={rootSearchNode} enums={enums} />
            </div>
            <div className="flex justify-content-between">
                <Button
                    label={t('clear_filters')}
                    outlined
                    onClick={handleClearFilters}
                />
                <Button
                    label={t('apply_filters')}
                    outlined
                    onClick={handleApplyFilters}
                />
            </div>
        </div>
    );
};

export default AdvancedSearch;
