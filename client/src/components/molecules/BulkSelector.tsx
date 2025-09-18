import {
    Dropdown,
    DropdownItem,
    DropdownList,
    MenuToggle,
    MenuToggleCheckbox,
} from "@patternfly/react-core";
import { useState } from "react";
import { Trans } from "react-i18next";

interface BulkSelectorProps {
    selectedCount: number;
    onPageCount: number;
    totalCount: number;
    onSelectNone: () => void;
    onSelectPage: () => void;
    onSelectAll: () => void;
    i18nPrefix?: string;
}

interface SelectCallbackItem {
    key: string;
    onClick: () => void;
    count: number;
}

const BulkSelector = ({
    selectedCount,
    onPageCount,
    totalCount,
    onSelectNone,
    onSelectPage,
    onSelectAll,
    i18nPrefix,
}: BulkSelectorProps) => {
    const anySelected = selectedCount > 0;
    const allSelected = selectedCount === totalCount;

    const selectOptions: SelectCallbackItem[] = [
        { key: "select-none", onClick: onSelectNone, count: 0 },
        { key: "select-page", onClick: onSelectPage, count: onPageCount },
        { key: "select-all", onClick: onSelectAll, count: totalCount },
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
                    aria-label="Select cards"
                    splitButtonItems={[
                        <MenuToggleCheckbox
                            id="split-dropdown-checkbox"
                            key="split-dropdown-checkbox"
                            aria-label={
                                anySelected
                                    ? "Deselect all cards"
                                    : "Select all cards"
                            }
                            isChecked={
                                allSelected ? true : anySelected ? null : false
                            }
                            onClick={() => {
                                setIsOpen(false);
                                allSelected ? onSelectNone() : onSelectAll();
                            }}
                        >
                            {selectedCount !== 0 && `${selectedCount} selected`}
                        </MenuToggleCheckbox>,
                    ]}
                />
            )}
        >
            <DropdownList>
                {selectOptions.map(({ key, onClick, count }) => (
                    <DropdownItem key={key} onClick={onClick}>
                        <Trans
                            i18nKey={`${
                                i18nPrefix ? `${i18nPrefix}.` : ""
                            }${key}`}
                            values={{ count }}
                        />
                    </DropdownItem>
                ))}
            </DropdownList>
        </Dropdown>
    );
};

export default BulkSelector;
