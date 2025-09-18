import { Trans } from "react-i18next";
import type { Priority } from "../models/common";
import { Icon, Label, type LabelProps } from "@patternfly/react-core";
import {
    PriorityHighestIcon,
    PriorityHighIcon,
    PriorityLowestIcon,
    PriorityLowIcon,
    PriorityMediumIcon,
} from "./PriorityIcons";
import type { JSX } from "react";

interface PriorityLabelProps {
    priority: Priority;
    withKeyword?: boolean;
}

// TODO: Palettes with divisions
// TODO: Use classes instead of inline styles
const priorityColors: { [key in Priority]: LabelProps["color"] } = {
    1: "blue", // blue - cold
    2: "teal", // light blue
    3: "grey", // gray - neutral
    4: "orange", // orange - warm
    5: "red", // red - hot
};
const priorityIcon: { [key in Priority]: JSX.Element } = {
    1: <PriorityLowestIcon />,
    2: <PriorityLowIcon />,
    3: <PriorityMediumIcon />,
    4: <PriorityHighIcon />,
    5: <PriorityHighestIcon />,
};

const PriorityLabel = ({
    priority,
    withKeyword = false,
}: PriorityLabelProps) => {
    return (
        <Label
            color={priorityColors[priority]}
            icon={<Icon>{priorityIcon[priority]}</Icon>}
            style={{
                fontWeight: "bold",
            }}
        >
            <Trans
                i18nKey={`project.priority.${
                    withKeyword && "with-keyword."
                }${priority}`}
            />
        </Label>
    );
};

export default PriorityLabel;
