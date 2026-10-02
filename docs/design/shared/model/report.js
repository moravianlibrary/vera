/* written by check.js — do not edit */
window.VERA_REPORT = {
 "at": "2026-10-02T07:16:41.247Z",
 "counts": {
  "transitions": 84,
  "actions": 26,
  "states": 43
 },
 "checks": [
  "states declared",
  "something creates it",
  "every state reachable",
  "no dead ends",
  "terminal is terminal",
  "permission declared",
  "scope accepted",
  "someone holds it",
  "holder sees the page",
  "offered on a page",
  "built in the demo",
  "plugin kind exists",
  "logged",
  "hook event exists",
  "every hook event fires",
  "every permission used",
  "pages ask for real permissions",
  "grants are declared",
  "every page has work"
 ],
 "findings": [
  {
   "check": "built in the demo",
   "level": "warn",
   "machine": "progress",
   "item": "reclassify-doc (action)",
   "text": "\"Reclassify — Documents\" — page-documents.js has no \"data-reclassify\""
  },
  {
   "check": "built in the demo",
   "level": "warn",
   "machine": "progress",
   "item": "relink (action)",
   "text": "\"Relink catalog record\" — page-documents.js has no \"data-relink\""
  },
  {
   "check": "built in the demo",
   "level": "warn",
   "machine": "progress",
   "item": "edit-descriptive (action)",
   "text": "\"Edit descriptive metadata\" — page-documents.js has no \"data-editmeta\""
  },
  {
   "check": "built in the demo",
   "level": "warn",
   "machine": "user",
   "item": "disable",
   "text": "\"Disable user\" — page-access.js has no \"data-udisable\""
  },
  {
   "check": "built in the demo",
   "level": "warn",
   "machine": "user",
   "item": "disable-norole",
   "text": "\"Disable user\" — page-access.js has no \"data-udisable\""
  },
  {
   "check": "built in the demo",
   "level": "warn",
   "machine": "user",
   "item": "message (action)",
   "text": "\"Message the user\" — page-access.js has no \"data-msg\""
  },
  {
   "check": "every permission used",
   "level": "warn",
   "machine": "—",
   "item": "watch",
   "text": "watch is granted but no page or transition uses it"
  }
 ],
 "graphs": [
  {
   "id": "request",
   "reachable": [
    "Pending",
    "Following",
    "Approved",
    "Denied",
    "Withdrawn"
   ]
  },
  {
   "id": "progress",
   "reachable": [
    "Enqueued",
    "IngestFailed",
    "Ready",
    "Planned",
    "InProgress",
    "Digitized",
    "Published"
   ]
  },
  {
   "id": "cancellation",
   "reachable": [
    "None",
    "Cancelled",
    "NotDigitizable"
   ]
  },
  {
   "id": "restriction",
   "reachable": [
    "None",
    "Forbidden",
    "Overruled"
   ]
  },
  {
   "id": "validation",
   "reachable": [
    "NotRequired",
    "Needed",
    "Approved",
    "Denied"
   ]
  },
  {
   "id": "project",
   "reachable": [
    "Proposed",
    "Approved",
    "Rejected",
    "Deleted"
   ]
  },
  {
   "id": "list",
   "reachable": [
    "Planned",
    "InProgress",
    "Done",
    "Deleted"
   ]
  },
  {
   "id": "mix",
   "reachable": [
    "Tracks",
    "Owns"
   ]
  },
  {
   "id": "user",
   "reachable": [
    "NoRole",
    "HasRole",
    "Disabled"
   ]
  },
  {
   "id": "delivery",
   "reachable": [
    "Waiting",
    "Sent",
    "Dead",
    "Discarded"
   ]
  },
  {
   "id": "task",
   "reachable": [
    "Running",
    "Finished",
    "Failed",
    "Cancelled"
   ]
  }
 ]
};
