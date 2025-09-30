import { useRef, useState } from "react";
import type {
    I18n,
    SettingsSectionConfig,
    SettingsSectionItemConfig,
    SettingsSectionState,
} from "../../models/ui/config";
import {
    Menu,
    MenuContainer,
    MenuContent,
    MenuItem,
    MenuList,
    MenuToggle,
} from "@patternfly/react-core";

interface SettingsMenuProps {
    config: SettingsSectionConfig[];
    state: Record<string, SettingsSectionState>;
    label: I18n;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({
    config,
    state,
    label,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);

    const [isOpen, setIsOpen] = useState<boolean>(false);

    const toggle = (
        <MenuToggle
            ref={toggleRef}
            onClick={() => setIsOpen(!isOpen)}
            isExpanded={isOpen}
        >
            {label}
        </MenuToggle>
    );

    const sectionItem = (
        sectionConfig: SettingsSectionConfig,
        itemConfig: SettingsSectionItemConfig,
        state: SettingsSectionState
    ) => {
        return (
            <MenuItem
                key={itemConfig.key}
                itemId={itemConfig.key}
                icon={itemConfig.icon}
                draggable={sectionConfig.reorderable}
                isSelected={state.selectedItems.has(itemConfig.key)}
                onDragEnd={(_event) => {
                    console.log("Drag end");
                    console.log(_event);
                }}
            >
                {itemConfig.label}
            </MenuItem>
        );
    };

    const sectionMenu = (
        config: SettingsSectionConfig,
        state: SettingsSectionState
    ) => {
        return (
            <Menu key={config.label} containsFlyout>
                <MenuContent>
                    <MenuList>
                        {config.items.map((item) =>
                            sectionItem(config, item, state)
                        )}
                    </MenuList>
                </MenuContent>
            </Menu>
        );
    };

    const section = (
        config: SettingsSectionConfig,
        state: SettingsSectionState
    ) => {
        return (
            <MenuItem
                key={config.key}
                itemId={config.key}
                icon={config.icon}
                flyoutMenu={sectionMenu(config, state)}
            >
                {config.label}
            </MenuItem>
        );
    };

    const menu = (
        <Menu ref={menuRef} containsFlyout>
            <MenuContent>
                <MenuList>
                    {config.map((item) => section(item, state[item.key]))}
                </MenuList>
            </MenuContent>
        </Menu>
    );

    return (
        <MenuContainer
            isOpen={isOpen}
            onOpenChange={(isOpen) => setIsOpen(isOpen)}
            menu={menu}
            menuRef={menuRef}
            toggle={toggle}
            toggleRef={toggleRef}
        />
    );
};

export default SettingsMenu;
