import {
    Button,
    MenuToggle,
    Select,
    SelectList,
    SelectOption,
    type MenuToggleElement,
} from "@patternfly/react-core";
import { TimesIcon } from "@patternfly/react-icons";
import { useState } from "react";

interface SelectOptionsProps {
    options: string[];
    icon: React.ReactNode;
    placeholder: string;
    compact?: boolean;
    selected: string;
    onSelect: (value?: string) => void;
}

const SelectOptions = ({
    options,
    icon,
    placeholder,
    compact,
    selected,
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
                    {!compact && selected && (
                        <Button
                            variant="plain"
                            onClick={() => onSelectChange(undefined)}
                            aria-label="Clear input value"
                            icon={<TimesIcon />}
                        />
                    )}
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
