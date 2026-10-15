# Scopes

A grant's scope says which records the permission reaches. A permission is held at a scope only
through a role ([permissions](permissions.md)). Custody and project membership are held through
people and groups ([custody](custody.md)).

| Scope | The record must be |
|---|---|
| own | the holder's own; only the self-scoped permissions |
| `custody` | in the holder's custody |
| `project` | on a project the holder is on |
| `managed` | a project the holder manages; only `project.edit`, `project.manage_members`, `project.delete` |
| `any` | anything |

Which permission accepts which scope is in the [catalog](permissions.md#the-catalog).

## The rules

#### SCOPE-own

A self-scoped grant reaches a record when the holder is its author:
- a proposal they asked;
- a run they started;
- a project they manage.

It reaches no iteration, category or intention.

#### SCOPE-custody-category

At `custody`, an iteration or a category is reached when the holder has custody of that category
or of any category above it.

#### SCOPE-custody-request

At `custody`, a proposal is reached when one of its request custodies has the holder as a
member, directly or through a group. Before approval, custody always means request custody
([ACCESS-request-custody](custody.md#access-request-custody)).

#### SCOPE-project

At `project`, a project is reached when the holder:
- manages it;
- is a member of it;
- is in a group that is a member of it.

An intention is reached through the project that funds it. An intention no project funds is
reached only at `any`.

#### SCOPE-managed

At `managed`, only a project whose manager the holder is.

#### SCOPE-any

At `any`, every record, including those no narrower scope can reach: the root of the category
tree, and intentions no project funds.

#### SCOPE-widest

Grants union across a person's roles. When the same permission is held at several scopes, it
reaches everything any of them reaches. There is no deny and no precedence: the only way not
to have something is not to be granted it.

#### SCOPE-list

At `custody` or `project`, a digitization list is reached when one of its members is reached:
- an iteration in the holder's custody;
- or one funded by a project they are on.

An empty list is reached only at `any`.

## Where a view's rows come from

A view's rows are its own fixed selection narrowed by the person's scope. A curator's
Documents Validations shows their custody because their `validation.*` grants are at
`custody`, not because the view says so.
