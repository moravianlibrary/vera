// Which of a project's acts the person may do, and their dialogs (projects.md §3;
// page-projects.js). Approve… and Reject… on a Proposed project for whoever decides projects,
// on its card and its page; on the page also Edit for its manager or a dig-curator, Delete…
// under More only while nothing was proposed into it, and Members' Edit on the members card.
// An act the person may not do is absent. Approve… comes first, as the primary, while it waits.
// *Message manager…* on the page reaches its manager, for anyone but the manager, while a Message
// instance is enabled (MSG-recipients, MSG-order).

import type { ProjectRow } from "@vera/contract/projects";
import type { Session } from "@vera/domain/entities";
import { can } from "@vera/domain/permissions";
import { scopeOfProject } from "@vera/domain/projects";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ViewAction } from "@/components/actions/action-bar";
import { MessageDialog } from "@/components/dialogs/message-dialog";
import {
  ApproveDialog,
  DeleteProjectDialog,
  MembersDialog,
  ProjectFormDialog,
  RejectDialog,
} from "@/features/projects/project-dialogs";
import { useMessageChannelsQuery } from "@/hooks/use-message-query";

type OpenDialog = "approve" | "reject" | "edit" | "members" | "delete" | "message" | null;

interface ProjectActionsOptions {
  row: ProjectRow;
  session: Session;
  onDeleted?: () => void;
}

export function useProjectActions({ row, session, onDeleted = () => {} }: ProjectActionsOptions) {
  const { t } = useTranslation("projects");
  const { project } = row;
  const scope = scopeOfProject(project);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const canDecide = project.state === "Proposed" && can(session, "project.decide");
  const { data: messageChannels = [] } = useMessageChannelsQuery();

  const decisionActions: ViewAction[] = canDecide
    ? [
        {
          id: "approve",
          label: t("projectActions.approve"),
          isPrimary: true,
          onSelect: () => setOpenDialog("approve"),
        },
        {
          id: "reject",
          label: t("projectActions.reject"),
          onSelect: () => setOpenDialog("reject"),
        },
      ]
    : [];
  const pageActions: ViewAction[] = [...decisionActions];
  if (can(session, "project.edit", scope)) {
    pageActions.push({
      id: "edit",
      label: t("projectActions.edit"),
      isPrimary: !canDecide,
      onSelect: () => setOpenDialog("edit"),
    });
  }

  if (messageChannels.length > 0 && project.managerId !== session.user.id) {
    pageActions.push({
      id: "message-manager",
      label: t("projectActions.messageManager"),
      onSelect: () => setOpenDialog("message"),
    });
  }

  if (can(session, "project.delete", scope) && row.proposalCount === 0) {
    pageActions.push({
      id: "delete",
      label: t("projectActions.delete"),
      isInMenu: true,
      isDestructive: true,
      onSelect: () => setOpenDialog("delete"),
    });
  }

  const canManageMembers = can(session, "project.manage_members", scope);
  const close = () => setOpenDialog(null);
  const dialogs = (
    <>
      {canDecide && (
        <>
          <ApproveDialog isOpen={openDialog === "approve"} onClose={close} row={row} />
          <RejectDialog isOpen={openDialog === "reject"} onClose={close} row={row} />
        </>
      )}
      <ProjectFormDialog
        key={[
          project.name,
          project.description,
          project.startsOn,
          project.endsOn,
          row.intention.targetPages,
        ].join("|")}
        isOpen={openDialog === "edit"}
        onClose={close}
        row={row}
        onSaved={() => {}}
      />
      {canManageMembers && (
        <MembersDialog
          key={`${project.managerId}-${project.memberIds.join()}-${project.memberGroupIds.join()}`}
          isOpen={openDialog === "members"}
          onClose={close}
          row={row}
        />
      )}
      <MessageDialog
        isOpen={openDialog === "message"}
        onClose={close}
        subject={{ kind: "project", id: project.id }}
        label={project.name}
        recipientLabel={t("projectActions.manager")}
      />
      <DeleteProjectDialog
        isOpen={openDialog === "delete"}
        onClose={close}
        row={row}
        onDeleted={onDeleted}
      />
    </>
  );

  return {
    // On its card: only the decision.
    cardActions: decisionActions,
    pageActions,
    // Opens the Members dialog; null when the person may not change who is on it.
    editMembers: canManageMembers ? () => setOpenDialog("members") : null,
    dialogs,
  };
}
