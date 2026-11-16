import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  batchSchema,
  categorySchema,
  documentSchema,
  iterationSchema,
  requestSchema,
  userSchema,
} from "@vera/domain/entities";
import { addHistory } from "./volume/history";
import { addLists } from "./volume/lists";
import { bookTitle, emailName, personName } from "./volume/names";
import { addPublic } from "./volume/public";
import { logNormal, mulberry32, type Random, weighted } from "./volume/random";
import { addRuns } from "./volume/runs";
import { baseNow, burstTimes, sampleArrival } from "./volume/time";
import { addValidation } from "./volume/validation";

type Row = Record<string, any>;
type Seed = {
  name: string;
  extends: string;
  now: string;
  collections: Record<string, any>;
  fakes: Record<string, any>;
};
const categoryNames = [
  "Dary",
  "DNNTO",
  "Kontinuita",
  "Vázané",
  "Rozšiřování sbírek",
  "CDArcha",
  "Požadavky čtenářů",
  "EODopen",
  "Kundera",
  "Monografie",
  "Periodika",
  "Rukopisy",
  "Mapy",
  "Hudebniny",
  "Grafika",
  "Fotografie",
  "Regionální literatura",
  "Historie",
  "Přírodní vědy",
  "Společenské vědy",
  "Technika",
  "Umění",
  "Jazykověda",
  "Literatura",
  "Noviny",
  "Časopisy",
  "Ročenky",
  "Sborníky",
  "Katalogy",
  "Ostatní",
  "Speciální fondy",
];
const categoryWeights = [
  ["Dary", 4713],
  ["DNNTO", 4209],
  ["Kontinuita", 2101],
  ["Vázané", 1857],
  ["Rozšiřování sbírek", 881],
  ["CDArcha", 879],
  ["Požadavky čtenářů", 854],
  ["EODopen", 330],
  ["Kundera", 213],
] as const;
const monthWeights = [
  0.9, 0.8, 1, 1, 1.2, 1, 1, 0.95, 2.5, 1, 0.35, 1.1, 1, 1, 1, 1.1, 0.9, 1.2, 1.1, 1, 1.1, 0.9,
  0.35, 1, 1, 1, 1, 1, 2,
];
const proposerShares = [6813, 3391, 2570, 1993, 1968, 321, 21, 21, 21, 15] as const;
const randInt = (random: Random, min: number, max: number) =>
  Math.floor(random() * (max - min + 1)) + min;
const timestamp = (date: Date) => date.toISOString();

function createCategories(): Row[] {
  const rows: Row[] = [{ id: "vc0", name: "Old VERA", parentId: null }];
  const roots = categoryNames.slice(0, 6);
  const children = categoryNames.slice(6, 29).filter((name) => name !== "Požadavky čtenářů");
  let childIndex = 0;
  for (let root = 0; root < roots.length; root++) {
    const id = `vc${root + 1}`;
    rows.push({ id, name: roots[root], parentId: "vc0" });
    const count = root === 0 ? 3 : root < 5 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const childId = `vc${7 + childIndex}`;
      rows.push({ id: childId, name: children[childIndex]!, parentId: id });
      if (childIndex < 2)
        rows.push({
          id: `vc${30 + childIndex}`,
          name: categoryNames[29 + childIndex]!,
          parentId: childId,
        });
      childIndex++;
    }
  }
  rows.push({ id: "vc32", name: "Požadavky čtenářů", parentId: "vc0" });
  return rows.map((row) => categorySchema.parse({ ...row, names: { en: row.name, cs: row.name } }));
}

function generate(base: Row, seedNumber = 1, scale = 1): Seed {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("--scale must be a positive number");
  const random = mulberry32(seedNumber);
  const docsTarget = Math.round(17134 * scale);
  const catalogTarget = Math.round(14183 * scale);
  const requesterCount = Math.max(1, Math.round(456 * scale));
  const staffCount = 10;
  const users: Row[] = [];
  const userAccess: Record<string, Row> = {};
  const staff = Array.from({ length: staffCount }, (_, index) => `vu${index + 1}`);
  for (let index = 0; index < staffCount; index++) {
    const id = staff[index]!;
    users.push(
      userSchema.parse({
        id,
        name: personName(random),
        kind: "person",
        email: `staff${index + 1}@example.org`,
      }),
    );
    userAccess[id] = {
      handRoleIds: [index < 3 ? "curator" : index < 5 ? "dig-curator" : "staff"],
      mappedRoles: [],
      identities: [
        { instanceId: "pi22", externalId: `volume-staff-${index + 1}`, lastLoginAt: base.now },
      ],
      entry: null,
    };
  }
  const requesters: string[] = [];
  for (let index = 0; index < requesterCount; index++) {
    const id = `vu${staffCount + index + 1}`;
    const instanceId = index % 2 === 0 ? "pi41" : "pi42";
    users.push(
      userSchema.parse({
        id,
        name: personName(random),
        kind: "person",
        email: emailName(index + 1),
      }),
    );
    userAccess[id] = {
      handRoleIds: [],
      mappedRoles: [{ roleId: "reader", instanceId, claim: "default role" }],
      identities: [{ instanceId, externalId: `volume-reader-${index + 1}`, lastLoginAt: base.now }],
      entry: null,
    };
    requesters.push(id);
  }
  for (let index = 0; index < 2; index++)
    users.push(
      userSchema.parse({
        id: `va${index + 1}`,
        name: index ? "Volume import two" : "Volume import one",
        kind: "agent",
        email: null,
      }),
    );

  const categories = createCategories();
  const catalogRecords: Row[] = [];
  const issuanceByCatalog = new Map<string, string>();
  const documents: Row[] = [];
  const iterations: Row[] = [];
  const requests: Row[] = [];
  const batches: Row[] = [];
  for (let index = 0; index < catalogTarget; index++) {
    const catalogId = `MZK01-9${String(index + 1).padStart(8, "0")}`;
    const issuance = weighted(random, [
      ["unset", 11423],
      ["Unit", 5367],
      ["Bundle", 183],
      ["Volume", 161],
    ] as const);
    issuanceByCatalog.set(catalogId, issuance);
    const type = issuance === "Volume" || issuance === "Bundle" ? "Periodical" : "Monograph";
    const units =
      type === "Periodical"
        ? Array.from(
            {
              length:
                issuance === "Bundle"
                  ? randInt(random, 3, 7)
                  : issuance === "Volume"
                    ? randInt(random, 2, 6)
                    : randInt(random, 1, 3),
            },
            (_, i) => `roč. ${i + 1}`,
          )
        : null;
    const barcodeCount = weighted(random, [
      [1, 8854],
      [2, 3483],
      [3, 1237],
      [5, 1400],
    ] as const);
    const barcodes: Record<string, string | null> = {};
    for (let i = 0; i < barcodeCount; i++)
      barcodes[`MZK-${String(index + 1).padStart(7, "0")}-${i + 1}`] =
        units?.[i % units.length!] ?? null;
    catalogRecords.push({
      catalogId,
      title: bookTitle(random),
      type,
      units,
      identifiers: [],
      shelfMarks: {},
      barcodes,
    });
  }

  let documentIndex = 0;
  const arrivals: Date[] = [];
  const arrivalBatchIds: string[] = [];
  const arrivalProposers: string[] = [];
  const burstSizes: number[] = [];
  while (arrivals.length < docsTarget) {
    const month = weighted(
      random,
      monthWeights.map((weight, index) => [index + 1, weight] as const),
    );
    const size = Math.min(35, logNormal(random, 3, 9), docsTarget - arrivals.length);
    let times: Date[] = [];
    for (let attempt = 0; attempt < 100; attempt++) {
      const start = sampleArrival(random, month);
      times = burstTimes(start, size, random);
      if (times.at(-1)!.getTime() < Date.parse(baseNow)) break;
    }
    if (times.at(-1)!.getTime() >= Date.parse(baseNow)) {
      throw new Error(`Could not sample a burst before ${baseNow} in month ${month}.`);
    }
    const batchId = `V-B${burstSizes.length + 1}`;
    const start = times[0]!;
    const takeover = new Date("2024-11-01T00:00:00.000Z");
    const rank4Start = new Date("2024-06-01T00:00:00.000Z");
    const rank = weighted(
      random,
      proposerShares.map(
        (share, index) =>
          [
            index,
            (index === 0 && start < takeover) ||
            (index === 3 && (start < rank4Start || start >= takeover))
              ? 0
              : share,
          ] as const,
      ),
    );
    const proposer = staff[rank]!;
    burstSizes.push(size);
    arrivals.push(...times);
    arrivalBatchIds.push(...Array.from({ length: size }, () => batchId));
    arrivalProposers.push(...Array.from({ length: size }, () => proposer));
  }
  for (
    let recordIndex = 0;
    recordIndex < catalogTarget && documentIndex < docsTarget;
    recordIndex++
  ) {
    const record = catalogRecords[recordIndex]!;
    const count = recordIndex < docsTarget - catalogTarget ? 2 : 1;
    for (
      let unitIndex = 0;
      unitIndex < count && documentIndex < docsTarget;
      unitIndex++, documentIndex++
    ) {
      const at = arrivals[documentIndex]!;
      const id = `V-D${documentIndex + 1}`;
      const progress = weighted(random, [
        ["Ready", 0.76],
        ["Enqueued", 0.07],
        ["InProgress", 0.02],
        ["Published", 0.15],
      ] as const);
      const unit = record.units
        ? { type: "volume-number", value: record.units[unitIndex % record.units.length]! }
        : null;
      const issuance = issuanceByCatalog.get(record.catalogId);
      const median =
        issuance === "Volume" ? 226 : issuance === "Bundle" ? 271 : issuance === "Unit" ? 157 : 154;
      const truePages = logNormal(random, median, median * 2.43);
      const sources: Row[] = [];
      if (random() < 0.76)
        sources.push({
          source: "catalog",
          tier: 50,
          value: Math.max(0, Math.round(truePages * (random() < 0.5 ? 0.78 : 1.22))),
          observedAt: timestamp(at),
          setBy: null,
        });
      if (random() < 0.05)
        sources.push({
          source: "predictor",
          tier: 20,
          value: Math.max(0, Math.round(truePages * (random() < 0.5 ? 0.13 : 3.87))),
          observedAt: timestamp(at),
          setBy: null,
        });
      if (random() < 0.06)
        sources.push({
          source: "manual",
          tier: 100,
          value: truePages,
          observedAt: timestamp(at),
          setBy: staff[0],
        });
      const document = documentSchema.parse({
        id,
        catalogId: record.catalogId,
        unit,
        title: record.title,
        type: record.type,
        shelfMark: null,
        pageSources: sources,
        registryRecords:
          progress === "Published"
            ? [
                {
                  registry: "Kramerius",
                  state: "Published",
                  rawState: "published",
                  linkKind: "content",
                  url: `https://kramerius.mzk.cz/view/${id}`,
                  observedAt: timestamp(at),
                  checkedAt: timestamp(at),
                  error: null,
                },
              ]
            : [],
        properties: [],
      });
      documents.push(document);
      const categoryName = weighted(random, categoryWeights);
      const category = categories.find((item) => item.name === categoryName) ?? categories[1]!;
      const iterationId = `V-IT${documentIndex + 1}`;
      const requestId = `V-R${documentIndex + 1}`;
      const batchId = arrivalBatchIds[documentIndex]!;
      const iteration = iterationSchema.parse({
        id: iterationId,
        documentId: id,
        attempt: 1,
        requestId,
        categoryId: category.id,
        priority: "Normal",
        projectId: null,
        progress,
        listId: null,
        formerListName: null,
        restriction: null,
        restrictionOverride: null,
        cancellation: null,
        defects: [],
        verdicts: [],
        ingestFailure: null,
        digitizedAt: progress === "Published" ? timestamp(new Date(at.getTime() - 86400000)) : null,
        links:
          progress === "Published"
            ? [
                {
                  id: `${id}-L1`,
                  url: `https://kramerius.mzk.cz/view/${id}`,
                  instanceId: null,
                  setBy: arrivalProposers[documentIndex]!,
                  setAt: timestamp(new Date(at.getTime() - 86400000)),
                  isPrimary: true,
                },
              ]
            : [],
        scanDpi: null,
        properties: [],
      });
      iterations.push(iteration);
      if (documentIndex === 0 || arrivalBatchIds[documentIndex - 1] !== batchId)
        batches.push(
          batchSchema.parse({
            id: batchId,
            name: `Scanner burst ${batches.length + 1}`,
            submittedBy: arrivalProposers[documentIndex]!,
            submittedAt: timestamp(at),
            size: burstSizes[batches.length],
            source: null,
          }),
        );
      requests.push(
        requestSchema.parse({
          id: requestId,
          documentId: id,
          requesterId: arrivalProposers[documentIndex]!,
          at: timestamp(at),
          reason: null,
          batchId,
          projectId: null,
          existingCopies: [],
          checkedAt: timestamp(at),
          decision: "Approved",
          iteration: { relation: "Originates", id: iterationId },
          rescan: null,
        }),
      );
    }
  }
  // Long running bulk imports are represented as agent batches in addition to staff arrivals.
  for (let index = 0; index < 3; index++)
    batches.push(
      batchSchema.parse({
        id: `V-BULK${index + 1}`,
        name: `Harvester import ${index + 1}`,
        submittedBy: `va${(index % 2) + 1}`,
        submittedAt: timestamp(new Date(Date.parse(base.now) - (index + 1) * 86400000)),
        size: Math.max(1, Math.round(randInt(random, 500, 1800) * scale)),
        source: null,
      }),
    );
  const publicResult = addPublic(
    random,
    scale,
    base.now ?? baseNow,
    requesters,
    staff,
    documents,
    iterations,
    requests,
    batches,
    catalogRecords,
    categories,
  );
  addValidation(random, iterations, staff, requests);
  const lists = addLists(
    random,
    iterations,
    documents,
    requests,
    staff,
    categories,
    base.now ?? baseNow,
    scale,
  );
  const runs = addRuns(random, base.now ?? baseNow, scale, base, iterations, staff);
  const statusLog = addHistory(
    requests,
    iterations,
    lists,
    batches,
    staff,
    base.now ?? baseNow,
    publicResult.decisions,
  );
  return {
    name: "volume",
    extends: "base",
    now: base.now ?? baseNow,
    collections: {
      users,
      userAccess,
      categories,
      documents,
      iterations,
      requests,
      batches,
      lists,
      runs,
      statusLog,
      pluginImplementations: [
        {
          id: "V-pt1",
          descriptorId: "cz.mzk.vera.marc-comparator",
          name: "MarcComparator",
          kind: "Validation",
          description: "Compares records with union catalog sources.",
          versions: [
            {
              version: "1.0.0",
              contractVersion: "1.0",
              signer: "Moravská zemská knihovna v Brně",
              installedAt: "2026-10-30",
              installedBy: "u3",
              triggers: ["OnIngest", "OnRecordChange", "OnSchedule", "OnDemand"],
              declares: {
                properties: [],
                identifierTypes: [],
                rawStates: [],
                rules: [],
                agent: null,
                generatorClass: null,
                channelInterface: null,
                loginEntry: null,
              },
              configFields: [],
            },
          ],
        },
      ],
      pluginInstances: [
        {
          id: "V-pi1",
          name: "Union catalog comparison",
          implementationId: "V-pt1",
          configuration: {},
          triggers: ["OnIngest"],
          createdAt: "2026-10-30",
          lastRunAt: null,
          version: "1.0.0",
          isEnabled: true,
          linkedCategoryId: null,
          settings: null,
          createdBy: "u3",
          isDeleted: false,
        },
      ],
    },
    fakes: { catalogRecords: [...(base.fakes?.catalogRecords ?? []), ...catalogRecords] },
  };
}

export { generate as generateVolumeSeed };

if (import.meta.main) {
  const args = process.argv.slice(2);
  const value = (name: string, fallback: string) => {
    const index = args.indexOf(name);
    return index < 0 ? fallback : (args[index + 1] ?? fallback);
  };
  const seedNumber = Number(value("--seed", "1"));
  const scale = Number(value("--scale", "1"));
  const output = resolve(value("--out", "seeds/volume.json"));
  const base = await Bun.file("seeds/base.json").json();
  const result = generate(base, seedNumber, scale);
  await mkdir(dirname(output), { recursive: true });
  const json = `${JSON.stringify(result)}\n`;
  await Bun.write(output, json);
  await mkdir("frontend/public/seeds", { recursive: true });
  await Bun.write("frontend/public/seeds/volume.json", json);
  console.log(`Wrote ${output} and frontend/public/seeds/volume.json`);
}
