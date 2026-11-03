import { expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { endpoints } from "@vera/contract/endpoints";
import { endpointOf } from "./endpoints";
import type { Recording } from "./recording";

// This list only shrinks; R2f empties it.
const notYetRecorded = [
  "loginEntries",
  "loginForm",
  "loginStart",
  "loginCallback",
  "signUp",
  "confirmEmail",
  "sendVerificationAgain",
  "resetPassword",
  "requestPasswordReset",
  "session",
  "logout",
  "roleCreate",
  "roleSave",
  "roleDelete",
  "localAccount",
  "userRoles",
  "userGroups",
  "identityLink",
  "identityDefaultRole",
  "identityUnlink",
  "userSuspend",
  "userRestore",
  "groupCreate",
  "groupSave",
  "groupMembers",
  "custodyCreate",
  "custodySave",
  "custodyMembers",
  "custodyDelete",
  "settingsGet",
  "settingsPatch",
  "proposalPhoto",
  "users",
  "groups",
  "roles",
  "watchlistChannels",
  "pushDevices",
  "pushDeviceRegister",
  "notificationPreferenceGet",
  "notificationPreferencePatch",
  "notificationHooks",
  "messageChannels",
  "messageHandOff",
  "messageSend",
  "lists",
  "digitizationLists",
  "digitizationListCreate",
  "digitizationListPool",
  "listGenerators",
  "listShapes",
  "listReading",
  "listGeneration",
  "listDetail",
  "listSave",
  "listStart",
  "listDonePreview",
  "listDone",
  "listDeletion",
  "listDelete",
  "listNotDigitizable",
  "projects",
  "projectIndex",
  "projectDetail",
  "projectCreate",
  "projectPreview",
  "projectSave",
  "projectMembers",
  "projectDecision",
  "projectApprove",
  "projectReject",
  "projectDelete",
  "categories",
  "categoryIndex",
  "categoryCreate",
  "categorySave",
  "categoryDelete",
  "categoryImpact",
  "categoryCustody",
  "categoryRefine",
  "mixes",
  "mixDetail",
  "mixCreate",
  "mixSetSave",
  "mixSnapshot",
  "mixPrimary",
  "mixArchive",
  "mixDelete",
  "intentions",
  "intentionIndex",
  "intentionPreview",
  "intentionTemplates",
  "intentionSave",
  "intentionArchive",
  "intentionUnarchive",
  "intentionCorrection",
  "intentionMix",
  "intentionDeletion",
  "intentionDelete",
  "intentionTemplateSave",
  "plugins",
  "pluginInstances",
  "pluginInstanceCreate",
  "pluginInstanceSave",
  "pluginInstanceDelete",
  "pluginInstanceEnable",
  "pluginInstanceDisable",
  "pluginInstanceImpact",
  "pluginInstanceRun",
  "pluginInstanceUpgradeRead",
  "pluginInstanceUpgrade",
  "pluginUpload",
  "pluginUploadInstall",
  "runningTasks",
  "taskRetention",
  "tasks",
  "taskDetail",
  "taskLog",
  "taskCancel",
  "taskRerun",
  "schedules",
  "scheduleCreate",
  "scheduleSave",
  "scheduleDelete",
  "schedulePause",
  "scheduleResume",
  "scheduleRun",
  "hooks",
  "hookCreate",
  "hookSave",
  "hookDelete",
  "hookPause",
  "hookResume",
  "hookRetry",
  "hookSendNow",
  "hookDeliveryRetry",
  "hookDeliveryDiscard",
  "hookPreview",
  "hookTest",
  "watchlists",
  "watchlistCreate",
  "watchlistReach",
  "watchlistSave",
  "watchlistViewer",
  "watchlistSeen",
  "watchlistDelete",
];

it("covers every endpoint with a recording call", () => {
  const directory = join(import.meta.dir, "../recordings");
  const recordings = readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")) as Recording);
  const calls = recordings.flatMap((recording) =>
    recording.scenarios.flatMap((scenario) => scenario.calls),
  );
  const uncovered = Object.entries(endpoints).filter(([name]) => {
    const recorded = calls.some((call) => endpointOf(call) === name);
    if (notYetRecorded.includes(name)) {
      expect(recorded, `${name} is listed as not yet recorded`).toBe(false);
      return true;
    }
    return !recorded;
  });

  for (const name of notYetRecorded) {
    expect(Object.hasOwn(endpoints, name), `${name} is an endpoint name`).toBe(true);
    expect(
      uncovered.some(([uncoveredName]) => uncoveredName === name),
      `${name} is uncovered`,
    ).toBe(true);
  }
  console.log(`notYetRecorded: ${JSON.stringify(notYetRecorded)}`);
  console.log(`uncovered: ${JSON.stringify(uncovered.map(([name]) => name))}`);
  expect(uncovered.map(([name]) => name)).toEqual([...notYetRecorded]);
});
