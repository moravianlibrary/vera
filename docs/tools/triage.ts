// Walks a queue of yes/no questions one at a time, so a backlog of open decisions can be
// answered quickly. Each question shows its context, what yes and no mean, and a
// recommendation. Answers are saved after every question to `<queue>.answers.json`, and a
// rerun skips what is already answered.
//
// Usage: bun docs/tools/triage.ts <queue.md>
//
// The queue is Markdown. Each question starts with a `## ` heading; then context paragraphs,
// and these lines:
//   ? the question, answerable yes or no
//   yes: what yes means
//   no: what no means
//   recommend: yes|no — why
//
// At the prompt: y, n or b (brainstorm), optionally followed by a note on the same line
// (`n keep it, but only for admins`). Also: s skips, u undoes the last answer, q quits.

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

type Question = {
  title: string;
  context: string[];
  ask: string;
  yes: string;
  no: string;
  recommend: string;
};

type Answer = { title: string; answer: "yes" | "no" | "brainstorm"; note: string };

const queuePath = process.argv[2];
if (queuePath === undefined || !existsSync(queuePath)) {
  console.error("usage: bun docs/tools/triage.ts <queue.md>");
  process.exit(1);
}

const answersPath = queuePath.replace(/\.md$/, "") + ".answers.json";

function parse(text: string): Question[] {
  return text
    .split(/^## /m)
    .slice(1)
    .map((block) => {
      const [title = "", ...lines] = block.split("\n");
      const question: Question = {
        title: title.trim(),
        context: [],
        ask: "",
        yes: "",
        no: "",
        recommend: "",
      };
      let paragraph: string[] = [];
      const flush = () => {
        if (paragraph.length > 0) {
          question.context.push(paragraph.join(" "));
          paragraph = [];
        }
      };
      for (const line of lines) {
        const field = line.match(/^(\?|yes:|no:|recommend:)\s*(.*)$/);
        if (field !== null) {
          flush();
          const [, key, value = ""] = field;
          if (key === "?") question.ask = value;
          if (key === "yes:") question.yes = value;
          if (key === "no:") question.no = value;
          if (key === "recommend:") question.recommend = value;
        } else if (line.trim() === "") {
          flush();
        } else if (/^\s*- /.test(line)) {
          flush();
          paragraph.push(line.trim());
          flush();
        } else {
          paragraph.push(line.trim());
        }
      }
      flush();
      return question;
    });
}

const width = Math.min(process.stdout.columns ?? 100, 100);
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;

function wrap(text: string, indent = ""): string {
  const lines: string[] = [];
  let line = indent;
  for (const word of text.split(/\s+/)) {
    if (line.length + word.length + 1 > width && line.trim() !== "") {
      lines.push(line);
      line = indent + (text.startsWith("- ") ? "  " : "");
    }
    line += (line.trim() === "" ? "" : " ") + word;
  }
  lines.push(line);
  return lines.join("\n");
}

function load(): Answer[] {
  return existsSync(answersPath) ? (JSON.parse(readFileSync(answersPath, "utf8")) as Answer[]) : [];
}

function save(answers: Answer[]): void {
  writeFileSync(`${answersPath}.tmp`, `${JSON.stringify(answers, null, 2)}\n`);
  renameSync(`${answersPath}.tmp`, answersPath);
}

const questions = parse(readFileSync(queuePath, "utf8"));
const answers = load();
const input = createInterface({ input: process.stdin, output: process.stdout });
const words: Record<string, Answer["answer"]> = { y: "yes", n: "no", b: "brainstorm" };

let skipped = new Set<string>();
for (;;) {
  const answered = new Set(answers.map((answer) => answer.title));
  const next = questions.find(
    (question) => !answered.has(question.title) && !skipped.has(question.title),
  );
  if (next === undefined) {
    break;
  }

  const position = questions.indexOf(next) + 1;
  console.clear();
  console.log(dim(`${position}/${questions.length} · ${answered.size} answered\n`));
  console.log(bold(next.title));
  console.log();
  for (const paragraph of next.context) {
    console.log(wrap(paragraph));
    if (!paragraph.startsWith("- ")) console.log();
  }
  console.log();
  console.log(bold(wrap(next.ask)));
  console.log();
  console.log(wrap(`${green("yes:")} ${next.yes}`));
  console.log(wrap(`${red("no:")}  ${next.no}`));
  console.log();
  console.log(cyan(wrap(`recommended: ${next.recommend}`)));
  console.log();

  const line = (await input.question(dim("y / n / b [note]   s skip · u undo · q quit > "))).trim();
  const key = line.charAt(0).toLowerCase();
  const note = line.slice(1).trim();
  if (key === "q") {
    break;
  }
  if (key === "s") {
    skipped.add(next.title);
    continue;
  }
  if (key === "u") {
    const undone = answers.pop();
    if (undone !== undefined) {
      skipped = new Set([...skipped].filter((title) => title !== undone.title));
      save(answers);
    }
    continue;
  }
  const answer = words[key];
  if (answer !== undefined) {
    answers.push({ title: next.title, answer, note });
    save(answers);
  }
}

input.close();
const counts = ["yes", "no", "brainstorm"].map(
  (kind) => `${answers.filter((answer) => answer.answer === kind).length} ${kind}`,
);
console.log(
  `\n${answers.length}/${questions.length} answered (${counts.join(", ")}). Saved to ${answersPath}`,
);
