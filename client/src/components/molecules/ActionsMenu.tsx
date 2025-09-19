import type { ActionConfig } from "../../models/ui/config";

interface ActionsMenuProps {
    config: ActionConfig[];
    disabled?: boolean;
}

const ActionsMenu: React.FC<ActionsMenuProps> = ({ config }) => {
    // Implementation of the ActionsMenu component goes here
    return <div>{/* Render actions based on config */}</div>;
};

export default ActionsMenu;
