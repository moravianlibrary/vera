import { Button } from "@patternfly/react-core";
import { TimesIcon } from "@patternfly/react-icons";
import { Fragment } from "react/jsx-runtime";

interface ToggleFiltersButtonProps {
    label: string;
    icon?: React.ReactNode;
    labelExpanded?: string;
    expanded: boolean;
    onToggle: () => void;
}

const ToggleFiltersButton: React.FC<ToggleFiltersButtonProps> = ({
    label,
    icon,
    labelExpanded,
    expanded,
    onToggle,
}) => {
    return (
        <Button variant="control" icon={icon} onClick={onToggle}>
            {!expanded && <Fragment>{label}</Fragment>}
            {expanded && (
                <Fragment>
                    {labelExpanded || label} <TimesIcon />
                </Fragment>
            )}
        </Button>
    );
};

export default ToggleFiltersButton;
