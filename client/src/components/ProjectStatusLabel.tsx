import { Trans } from "react-i18next";
import type { ProjectStatus } from "../models/project";

interface ProjectStatusLabelProps {
    status: ProjectStatus;
}

const ProjectStatusLabel = ({ status }: ProjectStatusLabelProps) => {
    return (
        <div>
            <span
                className={`project-status-label project-status-label--${status}`}
            >
                <Trans i18nKey={`project.status.${status}`} />
            </span>
        </div>
    );
};

export default ProjectStatusLabel;
