// The Digitization Lists editor surfaces (view-map.md §2.4): `/lists/new` needs `list.create`,
// `/lists/:listId/edit` needs `list.edit`; without it the page goes back to browse, as the action
// that leads here is absent. A Done list is history and is not edited.
// TODO(rrandiak): labels move to i18n.

import { Navigate, useParams } from "react-router";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { StatusNote } from "@/components/status-note";
import { hasPermission } from "@/domain/permissions";
import { ListEditor } from "@/features/lists/list-editor";
import { useListQuery } from "@/features/lists/use-lists-query";
import { useSessionQuery } from "@/hooks/use-session-query";

export function ListEditorPage() {
  const { listId = null } = useParams();
  const { data: session } = useSessionQuery();
  const { data: detail } = useListQuery(listId);

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
        <PageHeader title="New list" />
        <ListEditor detail={null} />
      </>
    );
  }

  if (detail === undefined) {
    return <PageHeader title="Edit list" />;
  }

  if (detail === null || detail.row.state === "Done") {
    return (
      <>
        <PageHeader title="Edit list" />
        <PageContent>
          <StatusNote tone="slate" title={detail === null ? "Not found" : "Done"}>
            {detail === null
              ? "This list is gone, or not yours to see."
              : "A Done list is history: what is on it and its dates no longer change."}
          </StatusNote>
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Edit list — ${detail.row.list.name}`} />
      <ListEditor key={detail.row.list.id} detail={detail} />
    </>
  );
}
