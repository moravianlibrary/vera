# User journeys

What each kind of person comes to VERA to do, step by step, with what they should see. A journey
is an acceptance test: the backend is built to pass every one, and each is a Playwright
test run against it (the engine of part 4 is retired,
[DEC-0023](../decisions/DEC-0023-the-engine-is-retired.md)). The user and admin guides are written from them later.

> **Draft, 2026-10-14.** Drafted from the frontend as built, for you to refine. Steps that need an
> act that is not built yet are marked **(not built)** and link to the ledger.

## The format

Each journey is one file:

| Part | What it says |
|---|---|
| **Who** | the person, by role, and the fixture person the dev server signs in as |
| **Goal** | what they want, in their words |
| **Starting state** | what must be true before step 1, named from the fixtures; the base seed reproduces it |
| **Steps** | numbered: what the person does, and what they see after it. An expected result is something a test can check |
| **Rules** | the reference rules the journey exercises |
| **Not covered** | what it deliberately leaves to another journey |

A journey names pages and acts as the UI does (*Approve…*, *Mark Done…*). It never restates a
rule: it cites one.

## Who signs in

The dev servers (`make dev-roles`) sign in one fixture person each:

| Role | Port | Person | How they hold it |
|---|---|---|---|
| `reader` | 5205 | Tomáš Marek (u5) | default role of eduID |
| `staff` | 5204 | Eva Horáková (u4) | mapped from Keycloak group `mzk-staff` |
| `curator` | 5202 | Kateřina Novotná (u8) | by hand; request custody Periodicals; category custody Maps directly and Periodicals via Periodicals Curators |
| `dig-curator` | 5203 | Martin Svoboda (u2) | mapped from Keycloak group `mzk-digitization`; request custody Moravica via Digitization Office |
| `admin` | 5201 | Petr Dvořák (u3) | by hand, and staff mapped from Keycloak |

## The journeys

| Journey | Who | Goal |
|---|---|---|
| [reader/propose](reader/propose.md) | reader | ask for documents to be digitized |
| [reader/follow](reader/follow.md) | reader | see what happened to my asks |
| [staff/propose-a-batch](staff/propose-a-batch.md) | staff | propose a longer list for the reading room |
| [curator/decide-proposals](curator/decide-proposals.md) | curator | decide the proposals in my custody |
| [curator/rule-on-defects](curator/rule-on-defects.md) | curator | clear what holds my items in review |
| [curator/look-after-my-items](curator/look-after-my-items.md) | curator | reclassify, stop and publish work in my custody |
| [curator/shape-my-branch](curator/shape-my-branch.md) | curator | change my part of the tree and who looks after it |
| [curator/run-a-project](curator/run-a-project.md) | curator | start a project, bring people onto it, decide projects |
| [digitization/build-a-list](digitization/build-a-list.md) | dig-curator | plan the next weeks of scanning |
| [digitization/generate-for-an-intention](digitization/generate-for-an-intention.md) | dig-curator | catch up on an intention that is behind |
| [digitization/plan-intentions](digitization/plan-intentions.md) | dig-curator | set what we aim to digitize, and in what proportion |
| [admin/manage-access](admin/manage-access.md) | admin | give people the right roles, groups and custodies |
| [admin/configure-plugins](admin/configure-plugins.md) | admin | keep the plugins configured and current |
| [admin/hooks-and-tasks](admin/hooks-and-tasks.md) | admin | keep notifications and background work running |
| [cross-role/from-ask-to-scan](cross-role/from-ask-to-scan.md) | reader, curator, dig-curator | one document from an ask to a published scan |
| [cross-role/a-funded-project](cross-role/a-funded-project.md) | curator, staff, admin | a project from its proposal to its items |
| [cross-role/custody-routing](cross-role/custody-routing.md) | admin, curator | a proposal reaching the right deciders |
| [cross-role/watchlist-news](cross-role/watchlist-news.md) | admin, curator | being told when something enters a watchlist |
