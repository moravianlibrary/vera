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

interface OptionsSelectProps {
    options: string[];
    placeholder: string;
    selected?: string;
    onSelect: (value?: string) => void;
}

const OptionsSelect = ({
    options,
    placeholder,
    selected,
    onSelect,
}: OptionsSelectProps) => {
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
                    onClick={() => setIsOpen(!isOpen)}
                    isExpanded={isOpen}
                >
                    {selected || placeholder}
                    {selected && (
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

export default OptionsSelect;
