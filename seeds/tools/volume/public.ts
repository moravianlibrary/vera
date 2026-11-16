// biome-ignore-all lint/suspicious/noExplicitAny: generated rows are validated with entity schemas.
import { batchSchema, documentSchema, iterationSchema, requestSchema } from "@vera/domain/entities";
import { bookTitle } from "./names";
import { logNormal, pick, type Random, weighted } from "./random";

const reasons = [
  "I would like to read this online.",
  "Please digitize this title.",
  "It would help my research.",
];
const declines = [
  [
    "Out of the library's collection scope",
    "The item falls outside the library's collecting policy.",
  ],
  ["Still under copyright", "The publication is not yet eligible for digitization."],
  ["Already available elsewhere", "A suitable digitized copy is already available."],
] as const;
const day = 86400000;
// The production profile has no request-hour counts, so hours are uniform from 07:00 to 23:00.
const randInt = (random: Random, min: number, max: number) =>
  Math.floor(random() * (max - min + 1)) + min;

function profileMonths(random: Random, now: string, scale: number): Date[] {
  const nowDate = new Date(now);
  const months: { year: number; month: number; min: number; max: number }[] = [];
  for (let year = 2023; year <= nowDate.getUTCFullYear(); year++) {
    const lastMonth = year === nowDate.getUTCFullYear() ? nowDate.getUTCMonth() : 11;
    for (let month = year === 2023 ? 0 : 0; month <= lastMonth; month++) {
      const range = year < 2025 ? [5, 15] : year === 2025 ? [25, 50] : [45, 80];
      months.push({
        year,
        month,
        min: Math.round(range[0]! * scale),
        max: Math.round(range[1]! * scale),
      });
    }
  }
  const monthCounts = months.map(({ min, max }) =>
    min === 0 && max === 0 ? 0 : randInt(random, min, Math.max(min, max)),
  );
  const dates: Date[] = [];
  for (let i = 0; i < months.length; i++) {
    const { year, month } = months[i]!;
    const monthDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let n = 0; n < monthCounts[i]!; n++) {
      let date: Date;
      for (;;) {
        const weekday = weighted(random, [
          [1, 169],
          [2, 189],
          [3, 273],
          [4, 187],
          [5, 188],
          [6, 159],
          [0, 142],
        ] as const);
        const dayOfMonth = randInt(random, 1, monthDays);
        date = new Date(
          Date.UTC(year, month, dayOfMonth, 7 + randInt(random, 0, 16), randInt(random, 0, 59)),
        );
        if (date.getUTCDay() === weekday) break;
      }
      if (date! < nowDate) dates.push(date!);
    }
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

export function addPublic(
  random: Random,
  scale: number,
  now: string,
  requesterIds: string[],
  staff: string[],
  documents: any[],
  iterations: any[],
  requests: any[],
  batches: any[],
  catalogRecords: any[],
  categories: any[],
) {
  const dates = profileMonths(random, now, scale);
  const singleCount = Math.min(requesterIds.length, Math.round(390 * scale));
  const repeatCount = Math.min(requesterIds.length - singleCount, Math.round(50 * scale));
  const powerCount = Math.max(
    0,
    Math.min(requesterIds.length - singleCount - repeatCount, Math.round(16 * scale)),
  );
  const multiFrequencies = Array.from({ length: repeatCount }, () => 2);
  const powerFrequencies = Array.from({ length: powerCount }, () => 21);
  const minimum = singleCount + repeatCount * 2 + powerCount * 21;
  const target = Math.max(dates.length, minimum);
  let remaining = target - minimum;
  for (let i = 0; i < multiFrequencies.length && remaining > 0; i++) {
    const extra = Math.min(8, remaining, randInt(random, 0, 8));
    multiFrequencies[i] += extra;
    remaining -= extra;
  }
  for (let i = 0; i < powerFrequencies.length && remaining > 0; i++) {
    const preferred = Math.max(21, Math.min(196, Math.round(logNormal(random, 34, 90))));
    const extra = Math.min(preferred - 21, remaining);
    powerFrequencies[i] += extra;
    remaining -= extra;
  }
  for (let i = 0; i < powerFrequencies.length && remaining > 0; i++) {
    const extra = Math.min(196 - powerFrequencies[i]!, remaining);
    powerFrequencies[i] += extra;
    remaining -= extra;
  }
  const requesterPlan: string[] = [];
  for (let i = 0; i < singleCount; i++) requesterPlan.push(requesterIds[i]!);
  for (let i = 0; i < repeatCount; i++)
    for (let n = multiFrequencies[i]!; n > 0; n--)
      requesterPlan.push(requesterIds[singleCount + i]!);
  for (let i = 0; i < powerCount; i++)
    for (let n = powerFrequencies[i]!; n > 0; n--)
      requesterPlan.push(requesterIds[singleCount + repeatCount + i]!);
  while (dates.length < target)
    dates.push(
      new Date(dates[Math.floor(random() * dates.length)]?.getTime() ?? Date.parse(now) - 1),
    );
  dates.sort((a, b) => a.getTime() - b.getTime());
  const duplicatePairs = Math.min(Math.floor(target / 3), Math.round(52 * scale));
  const existingTarget = Math.round(80 * scale);
  const requestPlans = dates.slice(0, target).map((at, index) => ({
    at,
    requesterId: requesterPlan[index] ?? requesterIds[index % requesterIds.length] ?? "vu11",
    index,
  }));
  for (let i = 0; i < Math.min(powerCount, 1); i++) {
    const requesterId = requesterIds[singleCount + repeatCount + i]!;
    const burst = requestPlans.filter((plan) => plan.requesterId === requesterId).slice(0, 20);
    if (burst.length) {
      const burstAt = new Date(burst[0]!.at);
      burstAt.setUTCHours(7 + randInt(random, 0, 16), randInt(random, 0, 59), 0, 0);
      for (const plan of burst) plan.at = burstAt;
    }
  }
  const curatorIds = staff.slice(0, 3);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const publicCategory = categoryById.get("vc32")?.id ?? "vc7";
  const staffPublished = iterations.filter((it) => it.progress === "Published");
  const decisions = new Map<string, any>();
  const duplicateFirst = new Map<
    number,
    { requestId: string; iterationId: string | null; approved: boolean }
  >();
  const titleForDuplicate = new Map<number, string>();
  const documentForDuplicate = new Map<number, string>();
  const documentByRequestId = new Map<string, string>();
  for (const request of requests) documentByRequestId.set(request.id, request.documentId);
  let copyCount = 0;
  for (const plan of requestPlans) {
    const { at, requesterId, index } = plan;
    const id = `V-PR${index + 1}`;
    const batchId = `V-PB${index + 1}`;
    const pairIndex = index < duplicatePairs * 2 ? Math.floor(index / 2) : -1;
    const isSecond = pairIndex >= 0 && index % 2 === 1;
    const title =
      pairIndex >= 0 ? (titleForDuplicate.get(pairIndex) ?? bookTitle(random)) : bookTitle(random);
    if (pairIndex >= 0 && !titleForDuplicate.has(pairIndex))
      titleForDuplicate.set(pairIndex, title);
    const duplicateRef = pairIndex >= 0 && isSecond ? duplicateFirst.get(pairIndex) : undefined;
    const recent = Date.parse(at.toISOString()) > Date.parse(now) - 14 * day;
    let decision: string =
      recent && random() < 0.16
        ? "Pending"
        : weighted(random, [
            ["Approved", 76],
            ["Denied", 23],
            ["Pending", 2],
          ] as const);
    if (decision === "Pending" && !recent) decision = random() < 0.77 ? "Approved" : "Denied";
    if (duplicateRef?.approved) decision = "Duplicate";
    const useCopy =
      decision === "Approved" &&
      copyCount < existingTarget &&
      staffPublished.length > 0 &&
      !isSecond;
    let documentId =
      pairIndex >= 0
        ? (documentForDuplicate.get(pairIndex) ?? `V-PD${index + 1}`)
        : `V-PD${index + 1}`;
    let existingCopies: any[] = [];
    if (useCopy) {
      const staffIteration = staffPublished[copyCount % staffPublished.length]!;
      copyCount++;
      documentId = staffIteration.documentId;
      existingCopies = [
        {
          source: "Kramerius",
          state: "Published",
          link: `https://kramerius.mzk.cz/view/${documentId}`,
          iterationId: staffIteration.id,
          seenAt: at.toISOString(),
          foundAfterApproval: false,
        },
      ];
    } else if (duplicateRef) {
      documentId = documentByRequestId.get(duplicateRef.requestId) ?? documentId;
    } else if (pairIndex >= 0 && documentForDuplicate.has(pairIndex)) {
      documentId = documentForDuplicate.get(pairIndex)!;
    } else {
      const catalogId = `MZK01-9${String(90000000 + index + 1).padStart(8, "0")}`;
      const pages = logNormal(random, 154, 374);
      catalogRecords.push({
        catalogId,
        title,
        type: "Monograph",
        units: null,
        identifiers: [],
        shelfMarks: {},
        barcodes: { [`MZK-PUBLIC-${index + 1}`]: null },
      });
      documents.push(
        documentSchema.parse({
          id: documentId,
          catalogId,
          unit: null,
          title,
          type: "Monograph",
          shelfMark: null,
          pageSources: [
            {
              source: "catalog",
              tier: 50,
              value: pages,
              observedAt: at.toISOString(),
              setBy: null,
            },
          ],
          registryRecords: [],
          properties: [],
        }),
      );
      if (pairIndex >= 0) documentForDuplicate.set(pairIndex, documentId);
    }
    const batch = batchSchema.parse({
      id: batchId,
      name: "Public digitization request",
      submittedBy: requesterId,
      submittedAt: at.toISOString(),
      size: 1,
      source: { instanceId: "pi43", name: "Tlačítko digitalizovat" },
    });
    batches.push(batch);
    const reason = random() < 0.05 ? null : pick(random, reasons);
    const request: any = {
      id,
      documentId,
      requesterId,
      at: at.toISOString(),
      reason,
      batchId,
      projectId: null,
      existingCopies,
      checkedAt: at.toISOString(),
      decision,
    };
    if (decision === "Pending") request.isAfterProjectApproval = false;
    let decisionAt: string | null = null;
    let actorId: string | null = null;
    if (decision === "Approved") {
      decisionAt = new Date(
        Math.min(Date.parse(now), at.getTime() + randInt(random, 2, 72) * 3600000),
      ).toISOString();
      actorId = pick(random, curatorIds);
      if (useCopy) {
        request.iteration = { relation: "Tracks", id: existingCopies[0]!.iterationId };
        request.rescan = null;
        duplicateFirst.set(pairIndex, {
          requestId: id,
          iterationId: existingCopies[0]!.iterationId,
          approved: true,
        });
      } else if (duplicateRef?.approved) {
        request.tracksIterationId = duplicateRef.iterationId;
      } else {
        const iterationId = `V-PIT${index + 1}`;
        const publish = random() < 0.96;
        const digitizedAt = new Date(Date.parse(decisionAt) + randInt(random, 3, 21) * day);
        const canPublish = publish && digitizedAt.getTime() < Date.parse(now);
        const iteration = iterationSchema.parse({
          id: iterationId,
          documentId,
          attempt: duplicateRef ? 2 : 1,
          requestId: id,
          categoryId: publicCategory,
          priority: "Normal",
          projectId: null,
          progress: canPublish ? "Published" : "Ready",
          listId: null,
          formerListName: null,
          restriction: null,
          restrictionOverride: null,
          cancellation: null,
          defects: [],
          verdicts: [],
          ingestFailure: null,
          digitizedAt: canPublish ? digitizedAt.toISOString() : null,
          links: canPublish
            ? [
                {
                  id: `${documentId}-L${duplicateRef ? 2 : 1}`,
                  url: `https://kramerius.mzk.cz/view/${documentId}${duplicateRef ? "/2" : ""}`,
                  instanceId: null,
                  setBy: actorId,
                  setAt: digitizedAt.toISOString(),
                  isPrimary: true,
                },
              ]
            : [],
          scanDpi: null,
          properties: [],
        });
        iterations.push(iteration);
        request.iteration = { relation: "Originates", id: iterationId };
        request.rescan = null;
        if (duplicateRef) request.iteration = { relation: "Originates", id: iterationId };
        duplicateFirst.set(pairIndex, { requestId: id, iterationId, approved: true });
      }
    } else if (decision === "Denied") {
      decisionAt = new Date(
        Math.min(Date.parse(now), at.getTime() + randInt(random, 2, 120) * 3600000),
      ).toISOString();
      actorId = pick(random, curatorIds);
      const decline = pick(random, declines);
      request.decline = {
        actorId,
        at: decisionAt,
        publicText: decline[0],
        internalText: decline[1],
      };
      if (!duplicateRef)
        duplicateFirst.set(pairIndex, { requestId: id, iterationId: null, approved: false });
    } else if (decision === "Duplicate") {
      request.tracksIterationId = duplicateRef?.iterationId;
    }
    requests.push(requestSchema.parse(request));
    documentByRequestId.set(id, documentId);
    decisions.set(id, { at: decisionAt, actorId });
  }
  return { decisions };
}
