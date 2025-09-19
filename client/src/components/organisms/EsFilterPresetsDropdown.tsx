import { Fragment } from "react/jsx-runtime";
import type { Name, UUID } from "../../models/common";
import {
    Button,
    Dropdown,
    DropdownGroup,
    DropdownItem,
    DropdownList,
    Icon,
    MenuToggle,
    type MenuToggleElement,
} from "@patternfly/react-core";
import { useState, type ReactNode } from "react";
import type { EsFilterPreset } from "../../models/ui/es";
import {
    CheckIcon,
    SaveIcon,
    StarIcon,
    TimesIcon,
    TrashIcon,
} from "@patternfly/react-icons";

interface EsFilterPresetsDropdownProps {
    // data
    systemPresets: EsFilterPreset[];
    userPresets: EsFilterPreset[];
    favorite?: UUID;
    active?: UUID;
    hasActiveFilters: boolean;

    // callbacks
    onSelect: (id: UUID) => void;
    onSave: (name: Name) => void;
    onDelete: (id: UUID) => void;
    onToggleFavorite: (id: UUID) => void;
}

const EsFilterPresetsDropdown: React.FC<EsFilterPresetsDropdownProps> = ({
    systemPresets,
    userPresets,
    favorite,
    active,
    hasActiveFilters,
    onSelect,
    onSave,
    onDelete,
    onToggleFavorite,
}) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<UUID | null>(
        null
    );

    const favoritePreset =
        favorite &&
        (userPresets.find((p) => p.id === favorite) ||
            systemPresets.find((p) => p.id === favorite));
    const otherSystemPresets = systemPresets.filter((p) => p.id !== favorite);
    const otherUserPresets = userPresets.filter((p) => p.id !== favorite);

    const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
            ref={toggleRef}
            onClick={() => setIsOpen(!isOpen)}
            isExpanded={isOpen}
        >
            Choose preset
        </MenuToggle>
    );

    const presetItem = (preset: EsFilterPreset, actions?: ReactNode) => (
        <DropdownItem
            value={preset.id}
            key={preset.id}
            isDisabled={preset.id === active}
            onClick={() => onSelect(preset.id)}
            actions={actions}
        >
            {preset.name}
        </DropdownItem>
    );

    const favoriteSection = (preset: EsFilterPreset) => (
        <DropdownGroup label="Favorite">{presetItem(preset)}</DropdownGroup>
    );

    const deleteAction = (preset: EsFilterPreset) =>
        preset.id == confirmingDeleteId ? (
            <Fragment>
                <Button
                    variant="plain"
                    icon={
                        <Icon status="danger">
                            <CheckIcon />
                        </Icon>
                    }
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(preset.id);
                        setConfirmingDeleteId(null);
                    }}
                />
                <Button
                    variant="plain"
                    icon={<TimesIcon />}
                    onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingDeleteId(null);
                    }}
                />
            </Fragment>
        ) : (
            <Button
                variant="plain"
                icon={
                    <Icon status="danger">
                        <TrashIcon />
                    </Icon>
                }
                onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingDeleteId(preset.id);
                }}
            />
        );

    const favoriteAction = (preset: EsFilterPreset) => (
        <Button
            variant="plain"
            icon={
                <StarIcon color={preset.id === favorite ? "gold" : undefined} />
            }
            onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(preset.id);
            }}
        />
    );

    const systemPresetsSection = (presets: EsFilterPreset[]) => (
        <DropdownGroup label="System presets">
            {presets.map((preset) =>
                presetItem(preset, favoriteAction(preset))
            )}
        </DropdownGroup>
    );

    const userPresetsSection = (presets: EsFilterPreset[]) => (
        <DropdownGroup label="Your presets">
            {presets.map((preset) =>
                presetItem(
                    preset,
                    <Fragment>
                        {deleteAction(preset)}
                        {favoriteAction(preset)}
                    </Fragment>
                )
            )}
        </DropdownGroup>
    );

    const saveCurrentAction = (
        <DropdownGroup label="Actions">
            <DropdownItem
                key="save_current"
                icon={<SaveIcon />}
                onClick={() => {
                    const name = prompt("Enter name for the new preset");
                    if (name) {
                        onSave(name as Name);
                    }
                }}
            >
                Save current filters
            </DropdownItem>
        </DropdownGroup>
    );

    return (
        <Fragment>
            <Dropdown
                isOpen={isOpen}
                onSelect={() => setIsOpen(false)}
                onOpenChange={(isOpen: boolean) => setIsOpen(isOpen)}
                toggle={toggle}
                ouiaId="BasicDropdown"
                shouldFocusToggleOnSelect
            >
                <DropdownList>
                    {favoritePreset && favoriteSection(favoritePreset)}
                    {otherSystemPresets.length > 0 &&
                        systemPresetsSection(otherSystemPresets)}
                    {otherUserPresets.length > 0 &&
                        userPresetsSection(otherUserPresets)}
                    {hasActiveFilters && !active && saveCurrentAction}
                </DropdownList>
            </Dropdown>
        </Fragment>
    );
};

export default EsFilterPresetsDropdown;
