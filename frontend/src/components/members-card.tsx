// Who is on a record (component-interfaces.md §4.4): people with their role, and groups, whose
// people are members while they are in them. Used for a project's members; group, custody and
// category custody members come with Users & Groups.

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DetailCard, DetailRow, Muted } from "@/components/detail-card";

export interface Member {
  kind: "user" | "group";
  id: string;
  label: string;
  // "manager", "member", "3 people".
  role?: string;
}

interface MembersCardProps {
  title: string;
  members: readonly Member[];
  action?: ReactNode;
  emptyText: string;
  children?: ReactNode;
}

export function MembersCard({ title, members, action, emptyText, children }: MembersCardProps) {
  const { t } = useTranslation("common");
  return (
    <DetailCard title={title} action={action}>
      {members.length === 0 && <Muted>{emptyText}</Muted>}
      {members.map((member) => (
        <DetailRow
          key={`${member.kind}-${member.id}`}
          aside={member.role === undefined ? undefined : <Muted>{member.role}</Muted>}
        >
          {member.label}
          {member.kind === "group" && <Muted> · {t("members.group")}</Muted>}
        </DetailRow>
      ))}
      {children}
    </DetailCard>
  );
}
