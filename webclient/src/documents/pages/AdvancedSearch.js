import { Button } from "primereact/button";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchGroup } from "../models/SearchNodes";
import AdvancedSearchNode from "../components/AdvancedSearchNode";
import DocumentField from "../models/DocumentField";
import { dataService } from '../../services/Data.js';

const FieldType = {
    TEXT: 'TEXT',
    NUMBER: 'NUMBER',
    CATEGORY: 'CATEGORY',
};

const AdvancedSearch = (props) => {
    const EMPTY_FILTER = SearchGroup.getDefault(0);
    const { t } = useTranslation();

    const [filter, setFilter] = useState(EMPTY_FILTER);

    const enums = {
        [DocumentField.CATEGORY.name]: {
            values: props.categories,
            placeholder: t('choose_category')
        }
    };

    const handleUpdateFilter = (data) => {
        setFilter(data);
    }

    const handleClearFilters = () => {
        setFilter(EMPTY_FILTER);
        localStorage.setItem('advanced_search', JSON.stringify(EMPTY_FILTER));
        if (props.onApplyFilter) {
            props.onApplyFilter(filter);
        }
    };

    const handleApplyFilters = () => {
        localStorage.setItem('advanced_search', JSON.stringify(filter.toJson()));
        if (props.onApplyFilter) {
            props.onApplyFilter(filter);
        }
    };

    useEffect(() => {
        const activeFilter = SearchGroup.fromJson(JSON.parse(localStorage.getItem('advanced_search')));
        if (activeFilter && !activeFilter.isEmpty()) {
            setFilter(activeFilter);
        }
    }, []);

    return (
        <div className="flex flex-column gap-1 flex-grow-0">
            <div className="overflow-auto" style={{ 'maxHeight': '75vh' }}>
                <AdvancedSearchNode data={filter} enums={enums} onDataUpdate={handleUpdateFilter} />
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
