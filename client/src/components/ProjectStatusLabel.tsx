import { Trans } from "react-i18next";
import type { ProjectStatus } from "../models/project";
import { Label } from "@patternfly/react-core";
import type { JSX } from "react";
import {
    QuestionCircleIcon,
    TimesCircleIcon,
    CheckCircleIcon,
} from "@patternfly/react-icons";

interface ProjectStatusLabelProps {
    status: ProjectStatus;
}

const statusColors: { [key in ProjectStatus]: string } = {
    Proposed: "purple",
    Approved: "green",
    Rejected: "red",
};

const statusIcon: { [key in ProjectStatus]: JSX.Element } = {
    Proposed: <QuestionCircleIcon color="purple" />,
    Approved: <CheckCircleIcon color="green" />,
    Rejected: <TimesCircleIcon color="red" />,
};

const ProjectStatusLabel = ({ status }: ProjectStatusLabelProps) => {
    // return statusIcon[status];
    return (
        <Label
            icon={statusIcon[status]}
            color={statusColors[status]}
            style={{
                fontWeight: "bold",
            }}
        >
            <Trans i18nKey={`project.status.${status}`} />
        </Label>
    );
};

export default ProjectStatusLabel;
