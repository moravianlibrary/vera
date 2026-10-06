// Which of a project's acts the person may do, and their dialogs (projects.md §3;
// page-projects.js). Approve… and Reject… on a Proposed project for whoever decides projects,
// on its card and its page; on the page also Edit for its manager or a dig-curator, Delete…
// under More only while nothing was proposed into it, and Members' Edit on the members card.
// An act the person may not do is absent. Approve… comes first, as the primary, while it waits.
// TODO(rrandiak): *Message…* (messaging.md §3) waits for a project subject on the message
// hand-off; labels move to i18n.

import { useState } from "react";
import type { ProjectRow } from "@/api/projects";
import type { ViewAction } from "@/components/actions/action-bar";
import type { Session } from "@/domain/entities";
import { can } from "@/domain/permissions";
import { scopeOfProject } from "@/domain/projects";
import {
  ApproveDialog,
  DeleteProjectDialog,
  MembersDialog,
  ProjectFormDialog,
  RejectDialog,
} from "@/features/projects/project-dialogs";

type OpenDialog = "approve" | "reject" | "edit" | "members" | "delete" | null;

interface ProjectActionsOptions {
  row: ProjectRow;
  session: Session;
  onDeleted?: () => void;
}

export function useProjectActions({ row, session, onDeleted = () => {} }: ProjectActionsOptions) {
  const { project } = row;
  const scope = scopeOfProject(project);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const canDecide = project.state === "Proposed" && can(session, "project.decide");

  const decisionActions: ViewAction[] = canDecide
    ? [
        {
          id: "approve",
          label: "Approve…",
          isPrimary: true,
          onSelect: () => setOpenDialog("approve"),
        },
        { id: "reject", label: "Reject…", onSelect: () => setOpenDialog("reject") },
      ]
    : [];
  const pageActions: ViewAction[] = [...decisionActions];
  if (can(session, "project.edit", scope)) {
    pageActions.push({
      id: "edit",
      label: "Edit",
      isPrimary: !canDecide,
      onSelect: () => setOpenDialog("edit"),
    });
  }

  if (can(session, "project.delete", scope) && row.proposalCount === 0) {
    pageActions.push({
      id: "delete",
      label: "Delete…",
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
          project.targetPages,
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
