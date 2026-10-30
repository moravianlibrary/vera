// biome-ignore-all lint/suspicious/noExplicitAny: rows are parsed by the entity schemas before output.
import { defectSchema, iterationSchema, validationVerdictSchema } from "@vera/domain/entities";
import { pick, type Random, weighted } from "./random";

const fields = [
  ["300", 5761],
  ["260", 4377],
  ["264", 2156],
  ["008", 839],
  ["020", 828],
  ["250", 798],
  ["015", 748],
  ["362", 47],
] as const;
const copy = {
  different: [
    "The record's extent differs from the union catalog.",
    "The publication details differ from the union catalog.",
  ],
  missing: [
    "A field present in the union catalog is missing.",
    "The record is missing a catalog field.",
  ],
  extra: ["The record has a field absent from the union catalog.", "An extra field needs review."],
};
const defectCounts = [
  [1, 20],
  [2, 35],
  [3, 25],
  [4, 12],
  [5, 6],
  [6, 2],
] as const;
const notes = [
  "Extent accepted as equivalent.",
  "Difference is not material.",
  "Catalog source checked.",
  "Approved after review.",
  "The record is suitable for digitization.",
];

export function addValidation(random: Random, iterations: any[], staff: string[], requests: any[]) {
  const requestById = new Map(requests.map((request) => [request.id, request]));
  let defectNo = 0;
  for (const iteration of iterations) {
    if (random() >= 0.94) continue;
    const count = weighted(random, defectCounts);
    const request = requestById.get(iteration.requestId);
    const keys = new Set<string>();
    const defects = [];
    for (let i = 0; i < count; i++) {
      let defect: any;
      do {
        const source = random() < 0.52 ? "SKC" : "CNB";
        const kind =
          source === "SKC"
            ? weighted(random, [
                ["DIFF", 65],
                ["MISSING", 18],
                ["EXTRA", 17],
              ] as const)
            : weighted(random, [
                ["DIFF", 48],
                ["MISSING", 48],
                ["EXTRA", 4],
              ] as const);
        const subject = weighted(random, fields);
        const code = `${source}-${kind}`;
        const at = new Date(
          Date.parse(request?.at ?? "2026-06-25T08:40:00.000Z") +
            300000 +
            Math.floor(random() * 600000),
        );
        defect = defectSchema.parse({
          key: `CatalogValidity:${code}:${subject}`,
          plugin: "CatalogValidity",
          ruleCode: code,
          subject,
          publicText: pick(
            random,
            copy[
              { DIFF: "different", MISSING: "missing", EXTRA: "extra" }[kind] as
                | "different"
                | "missing"
                | "extra"
            ],
          ),
          internalText: `MARC ${subject} differs from ${source}.`,
          firstSeenAt: at.toISOString(),
        });
      } while (keys.has(defect.key));
      keys.add(defect.key);
      defects.push(defect);
      defectNo++;
    }
    const mustApprove = !["Ready", "Enqueued"].includes(iteration.progress);
    const approvedCount = mustApprove
      ? defects.length
      : Math.floor(defects.length * (random() < 0.5 ? 0.4 : 0.6));
    const verdicts = approvedCount
      ? [
          validationVerdictSchema.parse({
            defectKeys: defects.slice(0, approvedCount).map((d) => d.key),
            verdict: "Approved",
            actorId: pick(random, staff.slice(0, 3)),
            at: new Date(
              Date.parse(defects[0]?.firstSeenAt ?? request?.at ?? "2026-06-25T08:40:00.000Z") +
                3600000,
            ).toISOString(),
            note: pick(random, notes),
            publicText: null,
          }),
        ]
      : [];
    iterationSchema.parse({ ...iteration, defects, verdicts });
    iteration.defects = defects;
    iteration.verdicts = verdicts;
  }
  return defectNo;
}
