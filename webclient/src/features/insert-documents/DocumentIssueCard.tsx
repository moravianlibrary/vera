import React, { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { ProgressBar } from "primereact/progressbar";
import { useTranslation } from "react-i18next";
import { CatalogIssueResponse, Issue } from "../../adapters/ApiDocuments";
import { DigitizationState } from "../../types/DigitizationState";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import { DigitizationRegistry } from "../../services/DigitizationRegistry";
import DigitizationStateTag from "../../components/tags/DigitizationStateTag";
import { Tag } from "primereact/tag";
import { createDigitizationRegistryLink } from "../../data/factories/LinksFactory";

enum IssueStates {
    AlreadyExists,
    DigitizationForbidden,
    Creating,
    Created,
}

type State = IssueStates | DigitizationState | null;

interface IssueDivProps {
    issue: CatalogIssueResponse;
    onClick: (issue: CatalogIssueResponse) => void;
}

interface DocumentIssueHeaderProps {
    issue: CatalogIssueResponse;
    state: State;
}

interface DocumentIssueContentProps {
    issue: CatalogIssueResponse;
    disabled?: boolean;
}

const DocumentIssueCard: React.FC<IssueDivProps> = ({ issue, onClick }) => {
    const { creatingIssues } = useInsertDocuments();

    const active =
        !issue.already_added &&
        issue.digitization_state === DigitizationState.NotDigitized;
    const [state, setState] = useState<State>(
        issue.already_added
            ? IssueStates.AlreadyExists
            : issue.digitization_state
    );

    const handleClick = () => {
        onClick(issue);
    };

    useEffect(() => {
        if (
            creatingIssues &&
            state === DigitizationState.NotDigitized &&
            creatingIssues.filter((i) => i.barcode === issue.barcode).length > 0
        ) {
            setState(IssueStates.Creating);
        }
    }, [creatingIssues]);

    useEffect(() => {
        if (!issue.newly_added) {
            setState(IssueStates.Created);
        }
    }, [issue.newly_added]);

    if (state !== null && state !== DigitizationState.NotDigitized) {
        return (
            <div
                className="flex flex-1 px-4 py-3"
                style={{ border: "1px solid black", borderRadius: "5px" }}
            >
                <div className="flex flex-column">
                    <DocumentIssueHeader issue={issue} state={state} />
                    <DocumentIssueContent issue={issue} disabled />
                </div>
            </div>
        );
    }

    return (
        <Button
            className="flex flex-1 overflow-visible text-gray-800"
            outlined
            disabled={!active}
            onClick={handleClick}
        >
            <div className="flex flex-column flex-1 align-items-start">
                <DocumentIssueHeader issue={issue} state={state} />
                <DocumentIssueContent issue={issue} />
            </div>
        </Button>
    );
};

const DocumentIssueHeader: React.FC<DocumentIssueHeaderProps> = ({
    issue,
    state,
}) => {
    const { t } = useTranslation();

    if (state === null) {
        return;
    }

    if (state === IssueStates.Creating) {
        return (
            <div className="flex p-2">
                <ProgressBar
                    mode="indeterminate"
                    style={{ height: "6px", width: "100%" }}
                />
            </div>
        );
    }

    const getTag = () => {
        if (
            state === IssueStates.AlreadyExists ||
            state === IssueStates.Created
        ) {
            return (
                <Tag
                    value={t("Document already exists")}
                    className="document-already-exists"
                />
            );
        }
        if (state === IssueStates.DigitizationForbidden) {
            return (
                <Tag
                    value={t("Digitization forbidden")}
                    className="digitization-forbidden"
                />
            );
        }
        return <DigitizationStateTag state={state} />;
    };

    const getLinkButton = () => {
        if (
            state === DigitizationState.Finished ||
            state === DigitizationState.InProgress ||
            state === DigitizationState.Planned
        ) {
            return (
                <Button
                    className="p-1"
                    text
                    onClick={() =>
                        window.open(
                            createDigitizationRegistryLink(
                                issue.digitization_registry_id!
                            ),
                            "_blank"
                        )
                    }
                >
                    <i className="pi pi-external-link" />
                </Button>
            );
        }
    };

    return (
        <div className="flex align-items-baseline">
            <div className="mb-2">{getTag()}</div>
            {getLinkButton()}
        </div>
    );
};

const DocumentIssueContent: React.FC<DocumentIssueContentProps> = ({
    issue,
    disabled,
}) => {
    const { t } = useTranslation();

    const className = disabled
        ? "flex flex-column flex-1 align-items-start text-gray-400"
        : "flex flex-column flex-1 align-items-start text-gray-800";

    return (
        <div className={className}>
            {issue.signature && (
                <div className="flex gap-1">
                    <span className="font-bold">{t("signature")}:</span>
                    <span>{issue.signature}</span>
                </div>
            )}
            {issue.barcode && (
                <div className="flex gap-1">
                    <span className="font-bold white-space-nowrap">
                        {t("Barcode")}:
                    </span>
                    <span>{issue.barcode}</span>
                </div>
            )}
            {issue.volume_year && (
                <div className="flex gap-1">
                    <span className="font-bold white-space-nowrap">
                        {t("Year")}:
                    </span>
                    <span>{issue.volume_year}</span>
                </div>
            )}
            {issue.volume && (
                <div className="flex gap-1">
                    <span className="font-bold white-space-nowrap">
                        {t("Volume")}:
                    </span>
                    <span>{issue.volume}</span>
                </div>
            )}
            {issue.bundle && (
                <div className="flex gap-1">
                    <span className="font-bold white-space-nowrap">
                        {t("Bundle")}:
                    </span>
                    <span>{issue.bundle}</span>
                </div>
            )}
        </div>
    );
};

export default DocumentIssueCard;
