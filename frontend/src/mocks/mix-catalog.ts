// Independent mix records and revision history. The legacy distribution array stores the shares
// until all consumers have moved to mix IDs; this API never derives ownership from an intention.

import type {
  MixDraft,
  MixRecord,
  MixSetChange,
  MixSnapshotDraft,
} from "@vera/contract/mix-catalog";
import type { Distribution, Session } from "@vera/domain/entities";
import { nameIn } from "@vera/domain/names";
import { can } from "@vera/domain/permissions";
import { database } from "@/mocks/database";
import { isVisible, nextId, replaceIntention } from "@/mocks/intentions";
import type { Outcome, Refusal } from "@/mocks/mutations";

const noRead: Refusal = { status: 403, message: "You may not read mixes" };
const noEdit: Refusal = { status: 403, message: "You may not edit mixes" };
const noManage: Refusal = { status: 403, message: "You may not manage mixes" };
const notFound: Refusal = { status: 404, message: "No such mix" };

const findMix = (id: string) => database.distributions.find((mix) => mix.id === id);

function recordOf(session: Session, mix: Distribution): MixRecord {
  const followers = database.intentions
    .filter((intention) => intention.distributionId === mix.id && isVisible(session, intention))
    .map((intention) => ({
      id: intention.id,
      name: intention.name,
      isArchived: intention.archived !== null,
    }));
  return {
    id: mix.id,
    name: mix.name,
    names: mix.names,
    isPrimary: mix.isPrimary,
    archivedAt: mix.archivedAt,
    shares: mix.shares,
    revision: mix.revision,
    revisions: mix.revisions,
    everUsed: database.mixUsedIds.has(mix.id),
    usageCount: followers.length,
    followers,
  };
}

export function listMixRecords(session: Session): Outcome<MixRecord[]> {
  if (!can(session, "mix.read")) return { refusal: noRead };
  return { value: database.distributions.map((mix) => recordOf(session, mix)) };
}

export function getMixRecord(session: Session, mixId: string): Outcome<MixRecord> {
  if (!can(session, "mix.read")) return { refusal: noRead };
  const mix = findMix(mixId);
  return mix === undefined ? { refusal: notFound } : { value: recordOf(session, mix) };
}

export function createMixRecord(session: Session, draft: MixDraft): Outcome<MixRecord> {
  if (!can(session, "mix.edit")) return { refusal: noEdit };
  if (
    database.distributions.some((mix) =>
      Object.entries(draft.names).some(
        ([language, name]) =>
          mix.names[language as "cs" | "en"]?.toLocaleLowerCase() === name?.toLocaleLowerCase(),
      ),
    )
  ) {
    return {
      refusal: { status: 409, code: "mix.name_taken", message: "A mix already has that name" },
    };
  }

  const source = draft.fromMixId === null ? null : findMix(draft.fromMixId);
  if (draft.fromMixId !== null && source === undefined) return { refusal: notFound };
  const revision =
    draft.fromRevision === null
      ? null
      : source?.revisions.find((candidate) => candidate.revision === draft.fromRevision);
  if (draft.fromRevision !== null && revision === undefined) {
    return {
      refusal: {
        status: 422,
        code: "mix.revision_not_found",
        message: "That mix revision does not exist",
      },
    };
  }

  const shares = { ...(revision?.shares ?? source?.shares ?? {}) };
  const mix: Distribution = {
    id: nextId("d", [
      ...database.distributions.map((candidate) => candidate.id),
      ...database.deletedMixIds,
    ]),
    name: nameIn(draft.names, "en"),
    names: draft.names,
    isPrimary: false,
    archivedAt: null,
    shares,
    revision: 1,
    revisions: [{ revision: 1, shares: { ...shares }, at: new Date().toISOString(), label: null }],
  };
  database.distributions.push(mix);
  return { value: recordOf(session, mix) };
}

export function saveMixRecordSet(
  session: Session,
  mixId: string,
  change: MixSetChange,
): Outcome<MixRecord> {
  if (!can(session, "mix.edit")) return { refusal: noEdit };
  const mix = findMix(mixId);
  if (mix === undefined) return { refusal: notFound };
  if (mix.archivedAt !== null) {
    return {
      refusal: {
        status: 409,
        code: "mix.is_archived",
        message: "This mix is archived; make an editable copy",
      },
    };
  }
  if (mix.revision !== change.revision) {
    return {
      refusal: {
        status: 409,
        message: "Somebody changed this mix meanwhile",
        code: "mix.revision",
      },
    };
  }
  const siblings = database.categories.filter((category) => category.parentId === change.parentId);
  if (
    siblings.length === 0 ||
    siblings.some((category) => !(category.id in change.shares)) ||
    Object.keys(change.shares).length !== siblings.length
  ) {
    return {
      refusal: {
        status: 422,
        code: "mix.child_missing",
        message: "Name every child in this category set",
      },
    };
  }
  const sum = Object.values(change.shares).reduce<number>(
    (total, share) => total + (share ?? 0),
    0,
  );
  if (sum > 100)
    return { refusal: { status: 422, code: "mix.over_hundred", message: "A set cannot pass 100" } };

  const shares = { ...mix.shares };
  for (const [categoryId, share] of Object.entries(change.shares)) {
    if (share === null) delete shares[categoryId];
    else shares[categoryId] = share;
  }
  const saved: Distribution = {
    ...mix,
    shares,
    revision: mix.revision + 1,
    revisions: [
      ...mix.revisions,
      {
        revision: mix.revision + 1,
        shares: { ...shares },
        at: new Date().toISOString(),
        label: null,
      },
    ],
  };
  database.distributions = database.distributions.map((candidate) =>
    candidate.id === mix.id ? saved : candidate,
  );
  return { value: recordOf(session, saved) };
}

export function snapshotMixRecord(
  session: Session,
  mixId: string,
  draft: MixSnapshotDraft,
): Outcome<MixRecord> {
  if (!can(session, "mix.edit")) return { refusal: noEdit };
  const mix = findMix(mixId);
  if (mix === undefined) return { refusal: notFound };
  const version = mix.revisions.find((candidate) => candidate.revision === draft.revision);
  if (version === undefined)
    return {
      refusal: { status: 422, code: "mix.revision_not_found", message: "No such revision" },
    };
  if (version.label !== null)
    return {
      refusal: {
        status: 409,
        code: "mix.revision_labelled",
        message: "That revision already has a snapshot label",
      },
    };
  const saved = {
    ...mix,
    revisions: mix.revisions.map((candidate) =>
      candidate.revision === draft.revision ? { ...candidate, label: draft.label } : candidate,
    ),
  };
  database.distributions = database.distributions.map((candidate) =>
    candidate.id === mixId ? saved : candidate,
  );
  return { value: recordOf(session, saved) };
}

export function makeMixPrimary(session: Session, mixId: string): Outcome<MixRecord> {
  if (!can(session, "mix.manage")) return { refusal: noManage };
  const mix = findMix(mixId);
  if (mix === undefined) return { refusal: notFound };
  if (mix.archivedAt !== null)
    return {
      refusal: {
        status: 409,
        code: "mix.is_archived",
        message: "An archived mix cannot be Primary",
      },
    };
  database.distributions = database.distributions.map((candidate) => ({
    ...candidate,
    isPrimary: candidate.id === mixId,
  }));
  return { value: recordOf(session, { ...mix, isPrimary: true }) };
}

export function archiveMixRecord(session: Session, mixId: string): Outcome<MixRecord> {
  if (!can(session, "mix.manage")) return { refusal: noManage };
  const mix = findMix(mixId);
  if (mix === undefined) return { refusal: notFound };
  if (mix.isPrimary)
    return {
      refusal: {
        status: 409,
        code: "mix.is_primary",
        message: "Choose a new Primary mix before archiving this one",
      },
    };
  if (mix.archivedAt !== null) return { value: recordOf(session, mix) };
  // Followers keep the final revision. Their selection never switches to Primary implicitly.
  for (const intention of database.intentions.filter(
    (item) => item.distributionId === mixId && item.archived === null,
  )) {
    replaceIntention({ ...intention, mixRevision: intention.mixRevision ?? mix.revision });
  }
  database.intentionTemplates = database.intentionTemplates.map((template) =>
    template.distributionId === mixId
      ? { ...template, mixRevision: template.mixRevision ?? mix.revision }
      : template,
  );
  const saved = { ...mix, archivedAt: new Date().toISOString() };
  database.distributions = database.distributions.map((candidate) =>
    candidate.id === mixId ? saved : candidate,
  );
  return { value: recordOf(session, saved) };
}

export function deleteMixRecord(session: Session, mixId: string): Outcome<null> {
  // ACT-mix-delete, PLAN-mix-remove
  if (!can(session, "mix.manage")) return { refusal: noManage };
  const mix = findMix(mixId);
  if (mix === undefined) return { refusal: notFound };
  if (mix.isPrimary)
    return {
      refusal: {
        status: 409,
        code: "mix.is_primary",
        message: "Choose a new Primary mix before removing this one",
      },
    };
  if (
    database.mixUsedIds.has(mixId) ||
    database.intentions.some((intention) => intention.distributionId === mixId) ||
    database.intentionTemplates.some((template) => template.distributionId === mixId) ||
    database.lists.some((list) => list.generated?.mixId === mixId)
  ) {
    return {
      refusal: {
        status: 409,
        code: "mix.in_use",
        message: "A mix that has been used cannot be removed; archive it instead",
      },
    };
  }
  database.distributions = database.distributions.filter((candidate) => candidate.id !== mixId);
  database.deletedMixIds.add(mixId);
  return { value: null };
}
