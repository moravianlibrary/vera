import type { AccessIndex } from "@vera/contract/access";
import {
  categoryCustodyOf,
  heldRolesOf,
  holdersOf,
  projectsOf,
  requestCustodyOf,
} from "@vera/domain/access";
import { Link } from "react-router";
import type { AccessNames } from "@/features/access/access-records";
import { categoryPath, categorySourcesOf, uniquePeople } from "@/features/access/access-resources";
import { i18n } from "@/i18n";

type Kind = "users" | "roles" | "groups" | "custodies" | "categories";
const message = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: "access", ...options });
export interface RelationshipSelection {
  kind: Kind;
  id: string;
}
interface Branch {
  label: string;
  links: { kind: Kind; id: string; title: string; source?: string; href?: string }[];
}

export function AccessRelationships({
  index,
  names,
  selected,
  onSelect,
}: {
  index: AccessIndex;
  names: AccessNames;
  selected: RelationshipSelection;
  onSelect: (selection: RelationshipSelection) => void;
}) {
  const branches: Branch[] = [];
  const add = (label: string, links: Branch["links"]) => {
    if (links.length) branches.push({ label, links });
  };
  if (selected.kind === "users") {
    const user = index.users.find((item) => item.id === selected.id);
    if (user) {
      add(
        message("relationships.roles"),
        heldRolesOf(user).map(({ roleId, ways }) => ({
          kind: "roles",
          id: roleId,
          title: names.role(roleId),
          source: ways
            .map((way) =>
              way.by === "hand"
                ? message("relationships.byHand")
                : message("relationships.mappedBy", { name: names.instance(way.instanceId) }),
            )
            .join(" · "),
        })),
      );
      add(
        message("relationships.groups"),
        user.groupIds.map((id) => ({
          kind: "groups",
          id,
          title: names.group(id),
          source: message("relationships.member"),
        })),
      );
      add(
        message("relationships.requestCustodySets"),
        requestCustodyOf(user.id, index.groups, index.custodies).map(({ custodyId, via }) => ({
          kind: "custodies",
          id: custodyId,
          title: names.custody(custodyId),
          source:
            via === null
              ? message("relationships.directMember")
              : message("relationships.viaGroup", { name: names.group(via) }),
        })),
      );
      add(
        message("relationships.categoryCustody"),
        categoryCustodyOf(user.id, index.groups, index.categoryMemberships).map(
          ({ categoryId, via }) => ({
            kind: "categories",
            id: categoryId,
            title: categoryPath(index, categoryId),
            source:
              via === null
                ? message("relationships.direct")
                : message("relationships.viaGroup", { name: names.group(via) }),
          }),
        ),
      );
      add(
        message("relationships.projects"),
        projectsOf(user.id, index.groups, index.projects).map(({ projectId, via }) => ({
          kind: "users",
          id: user.id,
          href: `/projects/${encodeURIComponent(projectId)}`,
          title: names.project(projectId),
          source:
            via === "manager"
              ? message("relationships.manager")
              : via === "member"
                ? message("relationships.directMember")
                : message("relationships.viaGroup", { name: names.group(via.groupId) }),
        })),
      );
    }
  } else if (selected.kind === "roles") {
    add(
      message("relationships.holders"),
      holdersOf(index.users, selected.id).map(({ user, ways }) => ({
        kind: "users",
        id: user.id,
        title: names.user(user.id),
        source: ways
          .map((way) =>
            way.by === "hand"
              ? message("relationships.byHand")
              : message("relationships.mappedBy", { name: names.instance(way.instanceId) }),
          )
          .join(" · "),
      })),
    );
  } else if (selected.kind === "groups") {
    const group = index.groups.find((item) => item.id === selected.id);
    if (group) {
      add(
        message("relationships.members"),
        group.memberIds.map((id) => ({
          kind: "users",
          id,
          title: names.user(id),
          source: message("relationships.member"),
        })),
      );
      add(
        message("relationships.requestCustodySets"),
        index.custodies
          .filter((item) => item.groupIds.includes(group.id))
          .map((item) => ({
            kind: "custodies",
            id: item.id,
            title: item.name,
            source: message("relationships.grantedToGroup"),
          })),
      );
      add(
        message("relationships.categoryCustody"),
        group.categoryIds.map((id) => ({
          kind: "categories",
          id,
          title: categoryPath(index, id),
          source: message("relationships.grantedToGroup"),
        })),
      );
      add(
        message("relationships.projects"),
        index.projects
          .filter((item) => item.memberGroupIds.includes(group.id))
          .map((item) => ({
            kind: "groups",
            id: group.id,
            href: `/projects/${encodeURIComponent(item.id)}`,
            title: item.name,
            source: message("relationships.groupMember"),
          })),
      );
    }
  } else if (selected.kind === "custodies") {
    const custody = index.custodies.find((item) => item.id === selected.id);
    if (custody) {
      add(
        message("relationships.directMembers"),
        custody.memberIds.map((id) => ({
          kind: "users",
          id,
          title: names.user(id),
          source: message("relationships.directMember"),
        })),
      );
      add(
        message("relationships.memberGroups"),
        custody.groupIds.map((id) => ({
          kind: "groups",
          id,
          title: names.group(id),
          source: message("relationships.groupMember"),
        })),
      );
      add(
        message("record.currentPluginOutput"),
        index.proposals
          .filter((item) => item.custodyIds.includes(custody.id))
          .map((item) => ({
            kind: "custodies",
            id: item.id,
            href: `/requests?id=${encodeURIComponent(item.id)}`,
            title: item.title,
            source: message("record.placedByCustodyRule"),
          })),
      );
    }
  } else {
    add(
      message("relationships.effectiveCustodians"),
      uniquePeople(categorySourcesOf(index, selected.id)).map((id) => ({
        kind: "users",
        id,
        title: names.user(id),
        source: categorySourcesOf(index, selected.id)
          .filter((item) => item.userId === id)
          .map((item) =>
            message("relationships.categorySource", {
              source:
                item.viaGroupId === null
                  ? message("relationships.direct")
                  : message("relationships.viaGroup", { name: names.group(item.viaGroupId) }),
              category: categoryPath(index, item.grantedOnId ?? selected.id),
            }),
          )
          .join(" · "),
      })),
    );
  }
  return (
    <section className="space-y-4" aria-label={message("relationships.focusedLabel")}>
      {branches.length === 0 && (
        <p className="text-sm text-muted-foreground">{message("relationships.empty")}</p>
      )}
      {branches.map((branch) => (
        <section key={branch.label} className="border-l-2 border-primary/50 pl-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {branch.label}
          </h3>
          <ul className="mt-2 space-y-2">
            {branch.links.map((link) => (
              <li
                key={`${link.kind}:${link.id}:${link.source ?? ""}`}
                className="relative text-sm before:absolute before:-left-4 before:top-2.5 before:w-3 before:border-t before:border-primary/50"
              >
                {link.href ? (
                  <Link className="font-medium text-primary hover:underline" to={link.href}>
                    {link.title}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => onSelect({ kind: link.kind, id: link.id })}
                  >
                    {link.title}
                  </button>
                )}
                {link.source && (
                  <span className="ml-2 text-xs text-muted-foreground">{link.source}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
