import {
    MenuToggle,
    Select,
    SelectList,
    SelectOption,
    type MenuToggleElement,
} from "@patternfly/react-core";
import { useState } from "react";

interface SelectOptionsProps {
    options: string[];
    icon: React.ReactNode;
    compact?: boolean;
    selected: string;
    placeholder: string;
    onSelect: (value?: string) => void;
}

const SelectOptions = ({
    options,
    icon,
    compact,
    selected,
    placeholder,
    onSelect,
}: SelectOptionsProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const onSelectChange = (value: string | undefined) => {
        onSelect(value);
        setIsOpen(false);
    };

    return (
        <Select
            id="option-variations-select"
            isOpen={isOpen}
            selected={selected}
            onSelect={(_event, value) => onSelectChange(value as string)}
            onOpenChange={(isOpen) => setIsOpen(isOpen)}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                    ref={toggleRef}
                    icon={icon}
                    onClick={() => setIsOpen(!isOpen)}
                    isExpanded={isOpen}
                >
                    {!compact && (selected || placeholder)}
                </MenuToggle>
            )}
            shouldFocusToggleOnSelect
        >
            <SelectList>
                {options.map((option) => (
                    <SelectOption key={option} value={option}>
                        {option}
                    </SelectOption>
                ))}
            </SelectList>
        </Select>
    );
};

export default SelectOptions;
