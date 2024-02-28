import React, { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { ProgressBar } from "primereact/progressbar";
import { useTranslation } from "react-i18next";
import { Issue } from "../../adapters/ApiDocuments";
import { DigitizationState } from "../../types/DigitizationState";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import { DigitizationRegistry } from "../../services/DigitizationRegistry";

enum IssueStates {
    AlreadyExists,
    Creating,
    Created,
}

type State = IssueStates | DigitizationState | null;

interface IssueDivProps {
    issue: Issue;
    onClick: (issue: Issue) => void;
}

interface DocumentIssueHeaderProps {
    issue: Issue;
    state: State;
}

interface DocumentIssueContentProps {
    issue: Issue;
    disabled?: boolean;
}

const DocumentIssueCard: React.FC<IssueDivProps> = ({ issue, onClick }) => {
    const { creatingIssues, createdIssues } = useInsertDocuments();
    
    const active = !issue.already_exists && issue.digitization_state === DigitizationState.NotDigitized;
    const [state, setState] = useState<State>(
        issue.already_exists ? IssueStates.AlreadyExists : issue.digitization_state
    );
    
    const handleClick = () => {
        onClick(issue);
    };

    useEffect(() => {
        if (creatingIssues && state === DigitizationState.NotDigitized && creatingIssues.filter(i => i.barcode === issue.barcode).length > 0) {
            setState(IssueStates.Creating);
        }
    }, [creatingIssues]);

    useEffect(() => {
        if (createdIssues && !issue.already_exists && createdIssues.filter(i => i.barcode === issue.barcode).length > 0) {
            setState(IssueStates.Created);
        }
    }, [createdIssues]);

    if (state !== null && state !== DigitizationState.NotDigitized) {
        return (
            <div className="px-4 py-3" style={{ border: '1px solid black', borderRadius: '5px' }} >
                <DocumentIssueHeader issue={issue} state={state} />
                <DocumentIssueContent issue={issue} disabled />
            </div>
        );
    }
    console.log(issue);

    return (
        <Button className="flex flex-1 overflow-visible text-gray-800" outlined
            disabled={!active || createdIssues.filter(i => i.barcode === issue.barcode).length > 0}
            onClick={handleClick}
        >
            <div className="flex flex-column flex-1 align-items-start">
                <DocumentIssueHeader issue={issue} state={state} />
                <DocumentIssueContent issue={issue} />
            </div>
        </Button>
    );
};

const DocumentIssueHeader: React.FC<DocumentIssueHeaderProps> = ({ issue, state }) => {
    const { t } = useTranslation();

    if (state === null) {
        return;
    }

    if (state === IssueStates.Creating) {
        return (
            <div className="flex p-2">
                <ProgressBar mode="indeterminate" style={{ height: '6px', width: '100%' }} />
            </div>
        );
    }

    const getMessage = () => {
        switch(state) {
            case IssueStates.AlreadyExists: return "Document already exists";
            case IssueStates.Created: return "Document already exists";
            case DigitizationState.Finished: return "Document already digitized";
            case DigitizationState.InProgress: return "Document digitization in progress";
            case DigitizationState.InProgress: return "Document digitization planned";
            default: return "";
        }
    };

    const getLinkButton = () => {
        if (state === DigitizationState.Finished
                || state === DigitizationState.InProgress
                || state === DigitizationState.Planned) {        
            return (
                <Button
                    className="p-1"
                    text
                    onClick={() => window.open(DigitizationRegistry.getDocumentLink(issue.barcode), '_blank')}
                >
                    <i className="pi pi-external-link" onClick={() => console.log('Icon clicked')} />
                </Button>
            );
        }
    }

    return (
        <div className="flex align-items-baseline">
            <span className="font-bold text-lg">{t(getMessage())}</span>
            {getLinkButton()}
        </div>
    );
}

const DocumentIssueContent: React.FC<DocumentIssueContentProps> = ({ issue, disabled }) => {
    const { t } = useTranslation();

    const className = disabled
        ? "flex flex-column flex-1 align-items-start text-gray-400"
        : "flex flex-column flex-1 align-items-start text-gray-800";

    return (
        <div className={className}>
            {issue.signature && <div className="flex gap-1">
                <span className="font-bold">{t('signature')}:</span>
                <span>{issue.signature}</span>
            </div>}
            {issue.barcode && <div className="flex gap-1">
                <span className="font-bold white-space-nowrap">{t('Barcode')}:</span>
                <span>{issue.barcode}</span>
            </div>}
            {issue.year && <div className="flex gap-1">
                <span className="font-bold white-space-nowrap">{t('Year')}:</span>
                <span>{issue.year}</span>
            </div>}
            {issue.volume && <div className="flex gap-1">
                <span className="font-bold white-space-nowrap">{t('Volume')}:</span>
                <span>{issue.volume}</span>
            </div>}
            {issue.bundle && <div className="flex gap-1">
                <span className="font-bold white-space-nowrap">{t('Bundle')}:</span>
                <span>{issue.bundle}</span>
            </div>}
        </div>
    )
}

export default DocumentIssueCard;
