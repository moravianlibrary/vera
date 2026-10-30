// The Digitization Lists editor surfaces (view-map.md §2.4): `/lists/new` needs `list.create`,
// `/lists/:listId/edit` needs `list.edit`; without it the page goes back to browse, as the action
// that leads here is absent. A Done list is history and is not edited. `/lists/new?generate…`
// is a new list an intention's card started (lists-view.ts `generationStartOf`).

import { can, hasPermission } from "@vera/domain/permissions";
import { useTranslation } from "react-i18next";
import { Navigate, useParams, useSearchParams } from "react-router";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { failureOf, QueryState } from "@/components/query-state";
import { StatusNote } from "@/components/status-note";
import { ListEditor } from "@/features/lists/list-editor";
import { generationStartOf } from "@/features/lists/lists-view";
import { useListQuery } from "@/features/lists/use-lists-query";
import { useSessionQuery } from "@/hooks/use-session-query";

export function ListEditorPage() {
  const { t } = useTranslation("lists");
  const { listId = null } = useParams();
  const { data: session } = useSessionQuery();
  const listQuery = useListQuery(listId);
  const { data: detail } = listQuery;
  const [params] = useSearchParams();

  if (session === undefined) {
    return null;
  }

  const permission = listId === null ? "list.create" : "list.edit";
  if (!hasPermission(session, permission)) {
    return <Navigate to="/lists" replace />;
  }

  if (listId === null) {
    return (
      <>
        <PageHeader title={t("editorPage.newList")} />
        <ListEditor
          detail={null}
          start={generationStartOf(params)}
          canOpenIntentions={can(session, "intention.read")}
        />
      </>
    );
  }

  if (detail === undefined) {
    return (
      <>
        <PageHeader title={t("editorPage.editList")} />
        {listId !== null && (
          <QueryState
            isLoading={listQuery.isLoading}
            failure={failureOf(listQuery, t("editorPage.loadFailure"))}
            loadingText={t("editorPage.loading")}
          >
            {null}
          </QueryState>
        )}
      </>
    );
  }

  if (detail === null || detail.row.state === "Done") {
    return (
      <>
        <PageHeader title={t("editorPage.editList")} />
        <PageContent>
          <StatusNote
            tone="slate"
            title={detail === null ? t("editorPage.notFound") : t("editorPage.doneTitle")}
          >
            {detail === null ? t("editorPage.gone") : t("editorPage.done")}
          </StatusNote>
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Edit list — ${detail.row.list.name}`} />
      <ListEditor
        key={detail.row.list.id}
        detail={detail}
        canOpenIntentions={can(session, "intention.read")}
      />
    </>
  );
}
