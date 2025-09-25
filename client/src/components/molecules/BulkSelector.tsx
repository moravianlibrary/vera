import {
    Dropdown,
    DropdownItem,
    DropdownList,
    MenuToggle,
    MenuToggleCheckbox,
} from "@patternfly/react-core";
import { useState } from "react";
import type { DynamicI18n, I18n } from "../../models/ui/config";

interface BulkSelectorLabels {
    selectNone: I18n;
    selectPage: DynamicI18n;
    selectAll: DynamicI18n;
    selectedCount: DynamicI18n;
}

interface BulkSelectorProps {
    selectedCount: number;
    onPageCount: number;
    totalCount: number;
    onSelectNone: () => void;
    onSelectPage: () => void;
    onSelectAll: () => void;
    labels: BulkSelectorLabels;
}

interface SelectCallbackItem {
    key: string;
    label: string;
    onClick: () => void;
}

const BulkSelector = ({
    selectedCount,
    onPageCount,
    totalCount,
    onSelectNone,
    onSelectPage,
    onSelectAll,
    labels,
}: BulkSelectorProps) => {
    const anySelected = selectedCount > 0;
    const allSelected = selectedCount === totalCount;

    const selectOptions: SelectCallbackItem[] = [
        {
            key: "select-none",
            label: labels.selectNone,
            onClick: onSelectNone,
        },
        {
            key: "select-page",
            label: labels.selectPage({ count: onPageCount }),
            onClick: onSelectPage,
        },
        {
            key: "select-all",
            label: labels.selectAll({ count: totalCount }),
            onClick: onSelectAll,
        },
    ];

    const [isOpen, setIsOpen] = useState<boolean>(false);

    return (
        <Dropdown
            onSelect={() => setIsOpen(false)}
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            toggle={(toggleRef) => (
                <MenuToggle
                    ref={toggleRef}
                    isExpanded={anySelected}
                    onClick={() => setIsOpen(!isOpen)}
                    splitButtonItems={[
                        <MenuToggleCheckbox
                            id="split-dropdown-checkbox"
                            key="split-dropdown-checkbox"
                            isChecked={
                                allSelected ? true : anySelected ? null : false
                            }
                            onClick={() => {
                                setIsOpen(false);
                                allSelected ? onSelectNone() : onSelectAll();
                            }}
                        >
                            {selectedCount !== 0 &&
                                labels.selectedCount({ count: selectedCount })}
                        </MenuToggleCheckbox>,
                    ]}
                />
            )}
        >
            <DropdownList>
                {selectOptions.map(({ key, label, onClick }) => (
                    <DropdownItem key={key} onClick={onClick}>
                        {label}
                    </DropdownItem>
                ))}
            </DropdownList>
        </Dropdown>
    );
};

export default BulkSelector;
