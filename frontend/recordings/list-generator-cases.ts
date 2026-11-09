import { mkdirSync, writeFileSync } from "node:fs";
import type { GenerateInput } from "@vera/domain/plugin-api/list-generator";
import { generate } from "@/mocks/list-generator";

const iteration = (id: string, categoryId: string, priority = "Normal") =>
  ({ id, categoryId, priority }) as GenerateInput["pool"][number]["iteration"];
const base: GenerateInput = {
  intention: { id: "I1", name: "Case intention" },
  hasMix: true,
  leaves: [
    { id: "c1", name: "North", parentId: "top", topCategoryId: "top", share: 50, nodeId: null },
    { id: "c2", name: "South", parentId: "top", topCategoryId: "top", share: 50, nodeId: null },
  ],
  nodes: [],
  pool: [],
  members: [],
  pages: 100,
  topCategoryIds: [],
  allocation: null,
};
const item = (id: string, categoryId: string, pages: number, priority = "Normal") => ({
  iteration: iteration(id, categoryId, priority),
  pages,
  askedAt: "2026-05-11T08:00:00.000Z",
});
const cases: Array<{
  name: string;
  input: GenerateInput;
  configuration: Record<string, string>;
  isAdvisor: boolean;
}> = [
  {
    name: "no-mix-slack",
    input: { ...base, hasMix: false, pool: [item("a", "c1", 40), item("b", "c2", 30)] },
    configuration: {},
    isAdvisor: false,
  },
  {
    name: "mix-filled",
    input: { ...base, pool: [item("a", "c1", 50), item("b", "c2", 50)] },
    configuration: {},
    isAdvisor: false,
  },
  {
    name: "short-leaf-rerespread",
    input: {
      ...base,
      leaves: [
        ...base.leaves,
        { id: "c3", name: "East", parentId: "top", topCategoryId: "top", share: 0, nodeId: null },
      ],
      pool: [item("a", "c1", 20), item("b", "c2", 30)],
    },
    configuration: {},
    isAdvisor: false,
  },
  {
    name: "top-category-left-out",
    input: { ...base, topCategoryIds: ["other"], pool: [item("a", "c1", 40)] },
    configuration: {},
    isAdvisor: false,
  },
  {
    name: "correction-stays-short",
    input: {
      ...base,
      nodes: [{ id: "n1", share: 100 }],
      leaves: base.leaves.map((leaf) => ({ ...leaf, nodeId: "n1" })),
      allocation: { n1: 80 },
      pool: [item("a", "c1", 20)],
    },
    configuration: {},
    isAdvisor: false,
  },
  {
    name: "members-count-toward-goal",
    input: {
      ...base,
      members: [{ iteration: iteration("m", "c1"), pages: 50 }],
      pool: [item("a", "c2", 50)],
    },
    configuration: {},
    isAdvisor: false,
  },
  {
    name: "tolerance-ten-percent",
    input: { ...base, pool: [item("a", "c1", 55), item("b", "c2", 55)] },
    configuration: { tolerance: "10%" },
    isAdvisor: false,
  },
  {
    name: "advisor-with-reason",
    input: { ...base, pool: [item("IT3", "c1", 50)] },
    configuration: {},
    isAdvisor: true,
  },
  {
    name: "advisor-without-reason",
    input: { ...base, pool: [item("unknown", "c1", 50)] },
    configuration: {},
    isAdvisor: true,
  },
];

const directory = new URL(
  "../../backend/testing/src/test/resources/list-generator/",
  import.meta.url,
);
mkdirSync(directory, { recursive: true });
for (const testCase of cases) {
  const answer = generate(testCase.input, testCase.configuration, testCase.isAdvisor);
  writeFileSync(
    new URL(`${testCase.name}.json`, directory),
    `${JSON.stringify({ ...testCase, answer }, null, 2)}\n`,
  );
}
