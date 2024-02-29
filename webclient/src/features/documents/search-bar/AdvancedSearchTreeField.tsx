import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchTreeField } from "../../../contexts/documents/search/SearchNodes";
import React from "react";
import { useDocumentsSearch } from "../../../contexts/documents/search/DocumentsSearchContext";
import { TreeSelect, TreeSelectChangeEvent, TreeSelectSelectionKeysType } from "primereact/treeselect";
import { TextOption, TreeOption } from "../../../types/SearchTypes";

interface AdvancedSearchTreeFieldProps {
    data: SearchTreeField;
}

type SelectedNodes = string | TreeSelectSelectionKeysType | TreeSelectSelectionKeysType[] | null | undefined;

const AdvancedSearchTreeField: React.FC<AdvancedSearchTreeFieldProps> = ({ data }) => {
    const { t } = useTranslation();
    const { getTreeFieldOptions, getTreeFieldPlaceholder } = useDocumentsSearch();

    const rootNode = getTreeFieldOptions(data.field!)!;
    const placeholder = getTreeFieldPlaceholder(data.field!);

    const [option, setOption] = useState(data.option);
    const [selectedNodes, setSelectedNodes] = useState<SelectedNodes>([]);

    const handleSelectOption = (e: DropdownChangeEvent) => {
        data.setOption(e.value);
        setOption(e.value);
    };

    const handleSelectNode = (e: TreeSelectChangeEvent) => {
        setSelectedNodes(e.value);
    };

    return (
        <div className="flex gap-1">
            <Dropdown className="w-12rem"
                value={option}
                onChange={handleSelectOption}
                options={Object.values(TreeOption)}
                placeholder={t('Select operation')} />
            {option !== TextOption.IsNull && option !== TextOption.IsNotNull &&
            <TreeSelect
                className="w-14rem w-full"
                placeholder={t(placeholder)}
                selectionMode="multiple" 
                value={selectedNodes}
                options={rootNode} 
                onChange={handleSelectNode}
                metaKeySelection={false}
            />}
        </div>
    );
};

export default AdvancedSearchTreeField;

