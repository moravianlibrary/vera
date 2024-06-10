import React, { useRef } from "react";
import { DataTable } from "primereact/datatable";
import { useTranslation } from "react-i18next";
import { useIntentions } from "../../contexts/categories/IntentionsContext";
import { Column } from "primereact/column";
import { Intention, IntentionCreate } from "../../adapters/ApiCategories";
import { IntentionClassification } from "../../types/IntentionClassification";
import { Tag } from "primereact/tag";
import { format } from "date-fns";
import DeleteButton from "../../components/buttons/DeleteButton";
import EditButton from "../../components/buttons/EditButton";
import EditIntentionMenu, {
    EditIntentionMenuRef,
} from "./components/EditIntentionMenu";
import ActionAccessComponent from "../../components/ActionAccessComponent";
import { ActionType } from "../../types/ActionType";
import { useAccess } from "../../contexts/access/AccessContext";

interface IntentionsTableProps {}

const IntentionsTable: React.FC<IntentionsTableProps> = (props) => {
    const { t } = useTranslation();
    const { intentions } = useIntentions();
    const { hasAction } = useAccess();

    return (
        <div>
            <DataTable
                className="documents-table"
                value={intentions}
                scrollable
                scrollHeight="calc(100vh - 170px)"
                columnResizeMode="expand"
            >
                <Column header={t("Name")} field="name" />
                <Column
                    header={t("Target page count")}
                    field="target_page_count"
                />
                <Column
                    header={t("Date range")}
                    body={(intention) => (
                        <IntentionDateRangeBody intention={intention} />
                    )}
                />
                <Column
                    header={t("Classification")}
                    body={(intention) => (
                        <IntentionClassificationBody intention={intention} />
                    )}
                />
                {hasAction(ActionType.EditCategoriesAll) && (
                    <Column
                        body={(intention) => (
                            <ActionButtonsBody intention={intention} />
                        )}
                    />
                )}
            </DataTable>
        </div>
    );
};

interface IntentionColumnBodyProps {
    intention: Intention;
}

const IntentionDateRangeBody: React.FC<IntentionColumnBodyProps> = ({
    intention,
}) => {
    const parseDate = (date: string) => {
        return format(new Date(date), "dd.MM.yyyy");
    };

    return (
        <div className="flex gap-1">
            <Tag className="tag-date">{parseDate(intention.start_date)}</Tag>
            <Tag className="tag-date">{parseDate(intention.end_date)}</Tag>
        </div>
    );
};

const IntentionClassificationBody: React.FC<IntentionColumnBodyProps> = ({
    intention,
}) => {
    const { t } = useTranslation();

    if (intention.classification === IntentionClassification.Previous) {
        return <Tag className="tag-ic-previous">{t("Previous")}</Tag>;
    } else if (intention.classification === IntentionClassification.Current) {
        return <Tag className="tag-ic-current">{t("Current")}</Tag>;
    } else if (intention.classification === IntentionClassification.Upcoming) {
        return <Tag className="tag-ic-upcoming">{t("Upcoming")}</Tag>;
    }
};

const ActionButtonsBody: React.FC<IntentionColumnBodyProps> = ({
    intention,
}) => {
    const { updateIntention, deleteIntention } = useIntentions();

    const editIntentionRef = useRef<EditIntentionMenuRef>(null);

    const handleUpdate = (params: IntentionCreate, intentionId?: number) => {
        if (!intentionId) {
            console.error("Intention id is not defined");
            return;
        }
        updateIntention(params, intentionId);
    };

    return (
        <div className="flex gap-1">
            <EditIntentionMenu
                ref={editIntentionRef}
                intention={intention}
                intentionId={intention.id}
                callback={handleUpdate}
            />
            <EditButton
                disabled={
                    intention.classification ===
                    IntentionClassification.Previous
                }
                onEdit={() => editIntentionRef.current?.toggle()}
            />
            <DeleteButton
                itemId={intention.id}
                disabled={
                    intention.classification !==
                    IntentionClassification.Upcoming
                }
                onDeleteItem={deleteIntention}
            />
        </div>
    );
};

export default IntentionsTable;
