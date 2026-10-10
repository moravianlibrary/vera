import { Link } from "react-router";
import type { AccessIndex } from "@/api/access";
import {
  categoryCustodyOf,
  heldRolesOf,
  holdersOf,
  projectsOf,
  proposalCustodyOf,
} from "@/domain/access";
import type { AccessNames } from "@/features/access/access-records";
import { categoryPath, categorySourcesOf, uniquePeople } from "@/features/access/access-resources";

type Kind = "users" | "roles" | "groups" | "custodies" | "categories";
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
        "Roles",
        heldRolesOf(user).map(({ roleId, ways }) => ({
          kind: "roles",
          id: roleId,
          title: names.role(roleId),
          source: ways
            .map((way) =>
              way.by === "hand" ? "by hand" : `mapped by ${names.instance(way.instanceId)}`,
            )
            .join(" · "),
        })),
      );
      add(
        "Groups",
        user.groupIds.map((id) => ({
          kind: "groups",
          id,
          title: names.group(id),
          source: "member",
        })),
      );
      add(
        "Proposal custody sets",
        proposalCustodyOf(user.id, index.groups, index.custodies).map(({ custodyId, via }) => ({
          kind: "custodies",
          id: custodyId,
          title: names.custody(custodyId),
          source: via === null ? "direct member" : `via ${names.group(via)}`,
        })),
      );
      add(
        "Category custody",
        categoryCustodyOf(user.id, index.groups, index.categoryMemberships).map(
          ({ categoryId, via }) => ({
            kind: "categories",
            id: categoryId,
            title: categoryPath(index, categoryId),
            source: via === null ? "direct" : `via ${names.group(via)}`,
          }),
        ),
      );
      add(
        "Projects",
        projectsOf(user.id, index.groups, index.projects).map(({ projectId, via }) => ({
          kind: "users",
          id: user.id,
          href: `/projects/${encodeURIComponent(projectId)}`,
          title: names.project(projectId),
          source:
            via === "manager"
              ? "manager"
              : via === "member"
                ? "direct member"
                : `via ${names.group(via.groupId)}`,
        })),
      );
    }
  } else if (selected.kind === "roles") {
    add(
      "Holders",
      holdersOf(index.users, selected.id).map(({ user, ways }) => ({
        kind: "users",
        id: user.id,
        title: names.user(user.id),
        source: ways
          .map((way) =>
            way.by === "hand" ? "by hand" : `mapped by ${names.instance(way.instanceId)}`,
          )
          .join(" · "),
      })),
    );
  } else if (selected.kind === "groups") {
    const group = index.groups.find((item) => item.id === selected.id);
    if (group) {
      add(
        "Members",
        group.memberIds.map((id) => ({
          kind: "users",
          id,
          title: names.user(id),
          source: "member",
        })),
      );
      add(
        "Proposal custody sets",
        index.custodies
          .filter((item) => item.groupIds.includes(group.id))
          .map((item) => ({
            kind: "custodies",
            id: item.id,
            title: item.name,
            source: "granted to group",
          })),
      );
      add(
        "Category custody",
        group.categoryIds.map((id) => ({
          kind: "categories",
          id,
          title: categoryPath(index, id),
          source: "granted to group",
        })),
      );
      add(
        "Projects",
        index.projects
          .filter((item) => item.memberGroupIds.includes(group.id))
          .map((item) => ({
            kind: "groups",
            id: group.id,
            href: `/projects/${encodeURIComponent(item.id)}`,
            title: item.name,
            source: "group member",
          })),
      );
    }
  } else if (selected.kind === "custodies") {
    const custody = index.custodies.find((item) => item.id === selected.id);
    if (custody) {
      add(
        "Direct members",
        custody.memberIds.map((id) => ({
          kind: "users",
          id,
          title: names.user(id),
          source: "direct member",
        })),
      );
      add(
        "Member groups",
        custody.groupIds.map((id) => ({
          kind: "groups",
          id,
          title: names.group(id),
          source: "group member",
        })),
      );
      add(
        "Current plugin output · open proposals",
        index.proposals
          .filter((item) => item.custodyIds.includes(custody.id))
          .map((item) => ({
            kind: "custodies",
            id: item.id,
            href: `/review/proposals?id=${encodeURIComponent(item.id)}`,
            title: item.title,
            source: "placed by custody rule",
          })),
      );
    }
  } else {
    add(
      "Effective custodians",
      uniquePeople(categorySourcesOf(index, selected.id)).map((id) => ({
        kind: "users",
        id,
        title: names.user(id),
        source: categorySourcesOf(index, selected.id)
          .filter((item) => item.userId === id)
          .map(
            (item) =>
              `${item.viaGroupId === null ? "direct" : `via ${names.group(item.viaGroupId)}`} on ${categoryPath(index, item.grantedOnId ?? selected.id)}`,
          )
          .join(" · "),
      })),
    );
  }
  return (
    <section className="space-y-4" aria-label="Focused relationships">
      {branches.length === 0 && (
        <p className="text-sm text-muted-foreground">No immediate relationships.</p>
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
