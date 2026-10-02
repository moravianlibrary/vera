# Documents

## Requestor

- use 'My Requests' instead of 'Requestor'
- order by:
1. Last accessed
2. Otherwise, highest-priority permitted workflow
3. Then the remaining workflows
- dropdown for current table users watchlists?
- join columns Dig. (App)	Dig. (Registries) into 1 - digitization status?
- when joined use 'VERA: ' prefix for apps digitization status / state
- backlink to proposals and additions (for users that have access for them)?
- link to category for users that have access to read categories
- there is no way currently to read forbidden message if forbidden
- for digitization status, if document was previously processed, then prefix it with 'VERA (prev.): '?
- category name can be multi level, if the targeted category is not level 0
- switching pages with keyboard or gestures
- forbidden text can be like footnote to that forbidden document row maybe - so it is visible without any action.
- denied should probably work like forbidden.
- theoretically every status could be as footnote (the whole row spanning rectangular badge??) to its row, with status at the begining and after it optional : {reason | description }. And reason and description would be good for all of them: like curator has to review it, forbbiden why, denied why, approved note... etc..


- charts in documents / additions / proposals - on top, configurable, downloadable
- ~~document properties plugins - order on same property~~ DONE - its the tier mechanism
- ~~properties defined as int, float, text, low cardinality, arrays~~ DONE
  -> docs/design/shared/entities/document-properties.md
  sources are ROWS not columns (old system hardcoded pageCountCatalog/Predicted/Manual
  + a pageCount() resolver - breaks the moment a 4th source appears)
  each plugin declares a TIER, highest tier that HAS a value wins, no coded fallback chain
  `manual` is the top tier, reserved. sticky (no plugin can correct it) + attributed
  ALL sources stay visible in the detail w/ source+tier+age - thats the old
  "display page count origin" requirement, generalised
  3 ways to have no value again: not asked / answered unknown / failed
  types decide what a property may DO: only enum+bool can be a facet, only
  int/float/date get range filters, MULTIVALUED IS NOT SORTABLE (sorting a set
  means picking a representative, every choice is arbitrary and invisible)
  scope: search keys = property keys where searchable -> a plugin adding `signature`
  makes `sig:` work with no change to the view-rules 3 table
  PLUGINS CANNOT ADD COLUMNS. default_visible is an offer, not a placement.
  installing a plugin must never silently push a measured view over budget.
  detail panel has no budget and shows everything - thats what makes that affordable
  page count: list generation reads effective(page_count) and nothing else, BUT
  because all sources are kept, List Building can say "38% of these pages are
  PREDICTED" instead of a number with a hidden error bar
  TODO(Plugins): who assigns tiers (a plugin self-declaring lets a bad one outrank
  the catalog - per-installation config is safer, costs an admin screen)
- units come from the CATALOG, enumerated by the catalog adapter (a plugin).
  requester PICKS one, never types it. documents created ON DEMAND not up front
  (a periodical w/ 400 volumes is not 400 rows the day its catalogued)
  the unit list at proposal time is a CATALOG lookup, not a query over documents -
  most of what it offers doesnt exist in VERA yet, thats normal not an error
  this is also what makes status-model 2.7 duplicate detection work: 2 people
  picking "volume 35" from the same enumeration produce the same catalogId+unitId
- timeline view for scheduled tasks
- landing page? some widgets for news in watchlist in all pages?
- filtering based on similar library to dataframes in java - with postgres listen use? When something updates, all listening apps gets retriggered and refresh data in that "dataframe". Should be fast filtering, updates still work.. benchmark first

- for intentions: maybe there should be option on intention to have it automatically assigned to new digitization lists (like checkbox would be default on)
  -> see intentions.md §5. pulls against "an intention is a plan you generate against":
  a standing policy that silently claims every list makes its progress figure
  meaningless (counts pages nobody chose for it). honest form = attach by default
  but VISIBLY at creation, 1 click to remove. a default, not a rule
- priority is now a 4-value ENUM, not 1-5: Urgent / High / Normal / Low
  declared ascending (Low < Normal < High < Urgent) so ORDER BY works off the type
  Normal is the default and sits BELOW High - it means "nobody judged it"
  only Urgent + High carry colour, keeps the badge at 1.5 pts
  NOT Medium/Normal - synonyms, order unreadable from the labels
  OPEN: the old scale's bottom value was skipped by list generators. 4 levels have
  no such value - either Low inherits it or Low just sorts last (sorts last suggested)


# Registries / duplicates

- registry status decided: docs/design/shared/entities/registry-status.md
  lives on the DOCUMENT not the iteration. its an OBSERVATION of someone elses
  system, not a 5th status axis - VERA doesnt own it and cant change it
- 3 registries: VERA (via other iterations), Kramerius (Published/NotFound),
  RDCZ (Planned/InProgress/Revision/Digitized). ALL of them give links
- but 2 KINDS of link, store which: content (a reader can open and read it)
  vs record (someone elses bookkeeping). Kramerius = content, RDCZ + VERA = record
  record links exist at EVERY state incl Planned - "who is planning this and when"
  is exactly what a curator needs. content links only exist once theres content
  readers get content links ONLY - telling someone "available" then dropping them
  on a planning entry is worse than offering no link
- store BOTH raw_state (verbatim) and state (normalised). mapping is per-registry
  plugin config. unknown value -> Unmapped, NEVER a guess
- 3 ways to not know, all rendered differently: never checked / NotFound / CheckFailed
  NotFound is an ANSWER. a registry down for a week must not render as "not there"
  observed_at != checked_at - "published (as of 6wks ago, unreachable since)"
- names that collide are NOT the same value: RDCZ Planned != VERA Planned.
  who said it is part of the value -> thats why its its own table w/ registry_id
- Revision: UNMAPPED, shown verbatim, NOT guessed. TODO(Plugins) ask RDCZ.
  wrong mapping lies to every curator silently; unmapped costs one moment of "huh"
  if it does mean a 2nd pass -> its not a state, its a second record (like our iterations)
- checks run ON A SCHEDULE (plugin executions can be scheduled)
- registry check is PART OF ELIGIBILITY -> curator sees "Kramerius: Published" at
  review time, cheapest possible moment. must produce NotEligible NOT Forbidden,
  so a curator can Accept and re-digitize. TODO(Plugins): which states -> NotEligible
- scheduled recheck can change the answer under an already-decided doc.
  same as validation rechecks: never moves progress back, shows as footnote
- 1 column in views, strongest evidence wins (any Published + its link),
  prefixed w/ the registry that said it. per-registry breakdown in the detail

- DUPLICATES (status-model 2.7) - this was the "2 Ready iterations = hell to model" one:
  answer is the situation must not arise. at most ONE ACTIVE request per document
  active = Approved AND (no iteration yet OR progress not in Digitized/Published)
  the "no iteration yet" part matters - theres a window after approval before ingest
  cancelled still counts as active (suspension not exit) -> resume, never duplicate
- 2 cases, do NOT conflate (i did at first):
  case 1 - several PENDING proposals, no work started yet. all legit, all reviewable.
    decision on ONE = decision on ALL (curator judges the DOCUMENT not the person).
    on approval oldest originates (its project funds it), rest get tracks_iteration_id
    => Proposal Review must show 1 ROW PER DOCUMENT with a count, not N rows
  case 2 - proposal arrives AFTER work started. nothing to review.
    auto decision = Duplicate + tracks. never enters review, no project, no category
- new decision value: Duplicate. the only decision NO PERSON makes.
  its a decision not an eligibility verdict because it RESOLVES the request
- requester NEVER sees the word "Duplicate" - they see the tracked iterations live
  status in My Requests. public text "already being digitized"
- tracks_iteration_id is NOT a 2nd request<->iteration relation. requests either
  PRODUCE or SHADOW, never both => iteration.request_id stays N:1, NO join table
  (i proposed M:N first, it was wrong - broke funding attribution + divergent decisions)
- demand is countable: count(tracks_iteration_id) = "5 people asked for this" = priority signal
- 3rd case: already FINISHED (here or elsewhere) -> eligibility NotEligible, curator
  CAN override + re-scan. in-flight has no override (would create a 2nd active iteration)
- abandoned tracked work (denied/withdrawn) -> shadows revert to Pending, oldest originates

# Status log

- was referenced in 8 files and DEFINED IN NONE. everything got deferred to it:
  resumed cancellations, "was on list X", changed property values, relinks,
  priority changes, My Requests provenance -> docs/design/shared/entities/status-log.md
- ONE log across all entities, not one per entity. a request BECOMES an iteration and
  My Requests has to show one continuous story across both - split it and every
  reader does a union+sort, and the first one to forget shows a gap
- LOG CAUSES NOT DERIVATIONS. progress derives from list_id + the list date, so
  Planned -> InProgress happens overnight with no actor and no moment.
  log "added to list #412" and "list #412 date moved", never "Ready -> Planned"
  otherwise you need a nightly job inventing events with no author
  same rule kills the volume problem: scheduled registry checks that confirm the
  same answer write NOTHING. log changes, not observations
- 2 events exist ONLY because the log exists, else theyd each need a column:
  `resumed` (cancellation flag clears completely, no cleared_at anywhere)
  `removed from list` / `list deleted` (list_id is current state - without the log,
  deleting a list erases every trace the work was ever scheduled)
- actor NEVER null: person | agent | system account. all 3 are user records.
  "ingest completed it" is information, a blank is not
- correlation_id: 1 click can write N rows (approving propagates to all concurrent
  proposals, 2.7). history renders a correlated group as ONE event, expandable.
  without it a users history looks like 4 people decided 4 times at the same instant
- 2 texts as everywhere (public/internal). the curators deny reason BECOMES the
  entrys texts - same values, not a copy. most entries need no text at all
- ONE provenance mechanism in the whole app. adding a second is how they disagree
- OPEN: retention (property churn could be noisy), from_value for derived state

# Concepts

- docs/design/shared/entities/concepts.md - the READ THIS FIRST doc.
  what a document / category / project / intention / distribution / request /
  digitization list each IS, WHY it exists, WHO its for. everything else we wrote
  is mechanism and assumes you read it
- the one sentence: VERA decides what gets digitized next, and keeps track of why
- the distinctions it pins down, each one a thing we got wrong at some point:
  document = the item, ITERATION = one attempt. anything that can differ between
    attempts (category, priority, funding, list, approval) is on the iteration
  category does TWO jobs - classification AND access - and they attach differently
  project = money + deadline, NOT a plan. what the money should buy is an intention
  project funds ITERATIONS not documents (rescan can be a different grant)
  intention = a TARGET not a SELECTION, never names documents => planned pages and
    delivered pages are 2 numbers that must never be added
  distribution = the SHAPE, intention = shape + size + deadline
  request = who asked. requests either PRODUCE an iteration or SHADOW one
  PROPOSAL and ADDITION ARE NOT ENTITIES - theyre PHASE NAMES for one request row:
    proposal = decision Pending | addition = decision Approved + no iteration yet
    status-model 5 already derived stages that way, so request.proposal_id
    (a 1:1 self-link "approved into") was a leftover from the OLD TWO-TABLE design
    and contradicted it. REMOVED, along with the mermaid edge
    the old system copied proposal -> addition on approval, which is literally where
    "user loses sight of their request the moment its approved" came from - the thing
    they were following STOPPED EXISTING. one row changing state cant have that bug
    the PAGES keep the names (thats what the work at each phase is called)
  also fixed: document-identity said "unit IDs are resolved during ingest" - wrong,
    a proposal must carry catalogId AND unitId because duplicate detection runs at
    PROPOSAL time and keys on the pair. couldnt wait for ingest
  list = CURRENT STATE not history, "was scheduled" lives in the status log
- 2 edges deliberately absent and load-bearing: category has NO link to project,
  intention has NO link to document. any view needing either is built on a join
  with no answer

# Intentions / distributions / categories

- docs/design/shared/entities/intentions.md
- SHARES ARE RECURSIVE. top categories split 100%, each parents children split
  THEIR PARENTS share, all the way down. effective(node) = share(node) x effective(parent)
  this CORRECTS relationships 2 which said "proportions of one intention sum to 1" -
  they sum to 1 PER SIBLING SET. flat reading makes Periodicals 40% and
  Periodicals/Regional 10% look like overlapping claims; recursively Regional = 4%
- PERCENTAGES, not relative weights. i proposed weights, it was WRONG:
  with weights A=1 B=1 C=2 -> 25/25/50. raise C to 3 -> 20/20/60. A and B's ROWS
  werent touched but WHAT THEY MEAN CHANGED. a curator who set Regional to 25%
  expects 25% tomorrow. a percentage is a COMMITMENT, has to be storable as one
- WRITE UNIT IS THE SIBLING SET, not the row - you cant set one childs % without
  deciding where the difference comes from. read+write under a LOCK ON THE
  DISTRIBUTION (FOR UPDATE). sum checked in the transaction, never in the client
  distribution-wide lock not per-sibling-set: rarely edited, constantly read
- tree changes underneath: new category gets 0% (cant take from allocations someone
  already made), removed category leaves its share UNALLOCATED.
  incomplete set is FLAGGED NOT CORRECTED. generation allocates only whats allocated
  (92% of the parents share) and REPORTS the rest. scaling up to fill = the same
  silent re-pricing weights were rejected for
  0% = deliberately EXCLUDED. shortfall never redistributes into a zeroed sibling
- DOCUMENTS ATTACH TO LEAVES ONLY. internal nodes classify nothing, they just split
  a share among children. kills the "parent competes with its own children" problem
  ASYMMETRY (deliberate): custody attaches at ANY node + inherits DOWN,
  classification attaches at LEAVES only. people/subtrees vs documents/bottom
  not expressible as a column constraint - "is a leaf" is about OTHER ROWS,
  so its a trigger or app invariant. must be one of those, the failure is silent
  a leaf that GAINS A CHILD: cant, while it still holds iterations. editor offers
  "create child + move all documents into it" - new child takes 100% of parents
  share, which is what the parent had. rejecting outright would be worse, a curator
  refining a too-coarse tree is doing the right thing
- DISTRIBUTION is its own named entity (it was in the old system too - w/ active flag
  + "default distribution where everything has equal percents"). many intentions
  point at ONE. thats what "use percentages from another intention" means.
  NOT a ref to another intention - that makes the borrower depend on the lenders
  whole lifecycle (archive the 2024 project, the 2026 target that borrowed breaks)
  shared means shared INCLUDING EDITS - editor must say how many intentions it affects
- 3 KINDS of intention: Project (funded + dates) | Target (no funding, aspirational) |
  Overall (a YARDSTICK, nothing generates against it, at most one)
  old system had isProject boolean - a boolean cant express the 3rd case
  Overall = the old Distribution.active flag, given a clearer job. measures actual
  output against the shape it SHOULD have. no target, no dates (a yardstick with a
  deadline is just another target)
  OPEN: does Overall measure pages Digitized or Published? suggest Digitized - the
  point where VERAs decisions stop affecting the number
- generation: target(cat) = target_pages x effective(cat). page counts come from
  effective(page_count), one input resolved once
  order within a category by priority THEN age of request (without the tiebreak
  a generator run is non-deterministic)
  REDISTRIBUTE SHORTFALL across siblings that still have supply, recursively, AND
  REPORT what it couldnt fill per category. a list silently 8% short of its own plan
  is worse than one that says so
  never split a document - page counts are lumpy, tolerance configurable, over/undershoot reported
- planned vs delivered are 2 different numbers and must never be summed (relationships 5.3
  makes the same warning one level up)
- NOTE: old system merged Intention and Project into one entity w/ isProject +
  Proposed/Accepted/Declined status. we keep them separate.

# View catalog

- docs/design/shared/view-catalog.md - what each of the 14 views SHOULD and
  SHOULD NOT include. this is what demos get built from
- the key section is 2: CONTROLS THAT EXIST IN EXACTLY ONE PLACE. thats what makes
  every "not here" have a REASON instead of being taste:
    selection + bulk -> List Building ONLY
    approve/decline proposal -> Proposals ONLY
    approve/deny/revoke validation -> Documents Validations ONLY
    ingest/retry -> Additions ONLY
    set category+priority -> Proposals (at approval) + Validation (after), nowhere else
    generate against intention -> DG ONLY
    distribution percentages -> Categories ONLY (shares are a property of the tree)
    advanced filter builder -> large+notebook, any view (only path to a watchlist)
- 3 things are in EVERY view and never listed per-entry: search box, status badge, Watch
- row identity is stated per view because its the thing we keep getting wrong:
    My Requests = one REQUEST (starts at proposal stage!)
    Documents / Validation / DG = one ITERATION
    Proposals = one DOCUMENT (not one proposal! several people propose the same item
      and a decision on one is a decision on all - 5 rows = deciding it 5 times,
      and 4 would vanish mid-session when the decision propagates)
      BUT the REASONS are per-asker and theyre the rows most important content.
      request.reason was MISSING FROM THE MODEL entirely - added. its the only
      decision-relevant thing a curator learns that no plugin can supply
      row = the decision unit, reasons = the evidence inside it
      `reason` col shows the single ask, or "3 reasons" - NEVER a truncated pick
      of one (that silently privileges whoever asked first)
      detail lists every asker + reason + date. each asker sees only their own
      same approval + different urgency -> thats why PRIORITY is set at this moment
      !! a propagated DECLINE REASON is read by everyone who asked, incl people whose
      reason the curator never opened. so it must be about the DOCUMENT ("too fragile",
      "already in Kramerius") NEVER about a motive ("your exhibition isnt a priority").
      the one place one-row-per-document actually costs something
    Additions = one ADDITION, grouped by batch
- columns costed per tier against the 1.1 budget, all fit. tightest: Documents small
  at 6/6 and phone 5/5, Validation large 11/12
- Validation's `defects` chip group shows D \ A - whats OUTSTANDING, never whats
  already accepted
- Proposals shows `askers` count + the REGISTRY column - "Kramerius: Published" at
  review time is the cheapest possible moment to avoid duplicated work
- Additions failure text is a FOOTNOTE not a column (exempt from budget, and its
  the thing the admin acts on)
- 5 = what NO view has: no disabled controls, no "—" for unreadable props, no 2nd
  provenance box, no plugin-added columns, 1 badge per row (except Digitized+new defect)
- biggest undrawn view = Plugins. most of it is the plugin contract, not written

# Page composition

- docs/design/shared/page-composition.md - how many SURFACES each page is made of.
  a page is rarely 1 screen. Categories alone = tree + % editor + custody + wizard
- 5 surface kinds: index / detail / editor / wizard / dialog
  EDITOR IS NOT DETAIL - a detail can be left at any moment and nothing is lost,
  an editor holds unsaved state so its the only surface that can REFUSE to close
- DETAIL DOCKS ONLY AT large. its 6 pts; at notebook the sidebar can be 4 and the
  filter rail 5, so 6 more doesnt fit under 18. below large its a drawer (free)
  this falls straight out of the budgets, its not a taste call
- detail is always a ROUTE (linkable from a notification / a status log entry)
- an editor that writes a SET is MODAL never inline - theres no half-saving a
  sibling set under a lock, so no UI may suggest there is
- a wizard OWNS the screen + has a route (survives reload, abandonable unambiguously)
- a dialog carries a REASON or its not a dialog (a confirm w/ no input is a speed bump)
- !! APPROVE ON PROPOSALS IS AN EDITOR NOT A CONFIRM - its where category+priority
  are set, the only place a human classifies. opens pre-filled (category suggested
  from catalog, priority Normal) WITH THE REASONS VISIBLE, since "needed for the
  March exhibition" is what argues for anything above Normal
  bulk approve = one category + one priority applied to everything selected. thats
  the only way a bulk action can set REQUIRED fields without inventing them per item
  (and its why bulk decline stays forbidden - 1 reason across many docs is a
  different claim than 1 classification across many docs)
- generate wizard: intention -> target -> PREVIEW -> create. preview is NOT optional,
  its where "what couldnt be filled per category" is shown BEFORE the list exists
- delete-a-list dialog shows a CONSEQUENCE PREVIEW: "returns 214 docs to the pool,
  12 already digitized keep their status, 3 held stay held"
- Tasks is the ONLY page hosting >1 view (running/scheduled/history) - same admin,
  genuinely different scopes. thats view-map 1's rule doing its job, not an exception
- 13 of 14 pages composable NOW. Users & Groups blocked on permissions (how many
  indexes it has depends on whether roles attach to users/groups/both).
  Plugins drawable as a shell, its detail tabs arrive with the plugin contract

# Demos — built

- see BUILD.md. 14 pages x 4 tiers = 56 files, all render clean under jsdom
- structure: shared/vera-model.js (axes + derivation, no data no DOM) +
  vera-data.js (ONE dataset, every page is a view over it) + vera-ui.js (shell) +
  page-*.js (one per page, COLUMNS PER TIER LIVE HERE) + thin html per tier
- 2 demo-only controls bottom of every page: `size` jumps tiers, `as` re-renders
  as a different actor -> absent-not-disabled becomes visible instead of described.
  try Additions as curator: same page, every action gone, failure text still readable
- the originals at docs/demos/*.html are UNTOUCHED (verified via git)
- things that only became obvious once rendered:
  Proposals 5 asks -> 3 ROWS
  Lidove noviny renders "Published . review needed" - the 1 badge exception, live
  Mapa Moravy is ABSENT from the generation pool - derives Ready but cancelled.
  the flag-not-position decision, visible
  Categories: Regional = 55% of 70% = 38.5%, Specialist flagged unallocated
- NAVBAR REWORKED after seeing it (user feedback, all correct):
  toggle is a ROW IN THE BAR under the logo, not a tab clipped to the outer edge
  NO group headers - one flat list. 14 entries dont need 4 headers to be findable
  NO counts on nav entries - "what are the numbers??" is the right question.
  a bare number doesnt say what it counts. counts moved to WATCHLISTS where the
  panel itemises them; a view's own volume goes in its page header
  WATCHLISTS = 1 row opening a POPOVER grouped by view, each row w/ its own count
  + a total on the row. it's the only part whose length the USER controls, so it
  must not be allowed to grow the sidebar
  RUNNING TASKS = a small PANEL with progress bars, not a link. progress is the
  whole message - "2 running" tells you nothing, two bars tell you whether to wait
  collapses to a filled dot on the rail
- PALETTE: loaded from the shadcn preset link w/ playwright. the page serves
  lab() values so reading the computed string gives NONSENSE - sample painted
  pixels instead. tools/palette.js re-reads it
  neutral base + MONO-BLUE chart ramp, radius .625rem
  one departure: preset --sidebar is near-white, we keep the DARK bar from the
  og demos but built from the preset's OWN dark neutrals (#171717/#262626)
- PLUGINS + HOOKS were stripped too far, rebuilt to og density:
  a PLUGIN IS A TYPE, you create named INSTANCES of it. MZK/NKP/VKOL Aleph are
  3 instances of 1 adapter - which is ALSO the shape multi-library VERA needs
  table is GROUPED by type w/ instance rows indented (config, linked to, runs,
  last run, state, actions) - thats the og structure and its better
  hooks: 3 tabs w/ counts, health column (runs/avg/failures), retention notice,
  per-row Configure/Test, dead letters keep their PAYLOAD
- PLAYWRIGHT now: tools/shots.js screenshots all 56 and FAILS the run on
  js errors / empty pages / overflow / COLUMNS CLIPPED inside a scroll container /
  HOVER PUSHING CONTENT. the last two are what a human misses
- 4 real defects it caught:
  detail stacked UNDER the table at large (appended to .main, a flex column,
    instead of being its sibling in the #app flex row)
  hover-expand PUSHED content 56px (position:absolute on hover takes it OUT OF
    FLOW - the exact fault it was meant to prevent). aside holds the width in
    flow now, an inner layer grows
  9 columns SILENTLY CLIPPED by overflow:hidden. card scrolls now + the docked
    detail closes to give the width back
  a READER was shown "RDCZ: Revision" - internal vocab in a public view.
    a reader gets a CONTENT link or nothing
- !! HONEST GAPS (dont trust these yet):
  BUDGETS ARE DECLARED NOT MEASURED. each page prints its cost from the design
  docs, not from counting the DOM. view-rules 1.4 is still the OLD measurement of
  the OLD documents.html. RE-MEASURE, esp notebook Validations at 17/18
  LOOKED AT but only by me - every page screenshotted and obvious faults fixed,
  but nobody has USED it. typography/spacing/density are a first pass
  most buttons are drawn not wired. what DOES work: sidebar toggle (persisted),
  the distribution selector + percentage editor, the generate preview
  search/filter are chrome not function
  /propose wizard referenced from My Requests but NOT BUILT

# Layout / responsivity

- multiple views per "view" - each demo page (documents, proposals, additions, categories, tasks, ...) should have variants per screen size, not just a fluid/reflowing single layout:
1. large monitors - full table, all columns, side panels (filters, detail) visible at once
2. notebooks - table with less columns, filters collapsible / in drawer, detail as drawer or split
3. smaller (tablet / narrow window) - reduced table or list, filters in drawer, detail full-screen
4. phones - card/list per document instead of table, primary property + status only, everything else behind expand / detail page
- which columns survive at each size should be per-view decision, not automatic truncation
- status/reason footnote badges (see Documents notes) need own treatment on phones - inline under card instead of row-spanning rectangle
- charts on top of documents / additions / proposals: on phones probably collapsed by default, or single chart with switcher
- decide breakpoints once, globally, and keep them same across all views
- decided (demos in large/ notebook/ small/ phone/, documents.html done first, index.html links them):
  large >= 1600 | notebook 1280-1599 | small 768-1279 | phone < 768
- original demos in docs/demos/*.html left untouched as the reference
- rules these have to satisfy: docs/design/shared/view-rules.md
  (visual points, overview vs advanced filtering, search pattern table, actors, actions)
- 3 demo variants currently violate the point budgets - see its conformance table
- keyboard page switching is desktop-only; gestures (swipe) are the phone equivalent - same action, different input


# Navigation / shell

- shell decided: docs/design/shared/navigation.md
  14 entries, rework.md names AND order kept - it already falls into Work/Plan/Operate/Configure
  My Requests ADDED above Documents - the only addition. request row != iteration row,
  a Documents row cant show a proposal still awaiting review. reader sees ONLY My Requests,
  Documents becomes staff+ reference
  rail abbrevs are NOT prefixes (4 entries start with D). one word -> 2 letters,
  multi-word -> initials:  Do DV DG Pr Ad Pj Ca In DL Ta UG Pl Ho + MR
  casing tells you which kind it is. Pj for Projects because Pr is Proposals
  rail = icon + 2 letters (icons alone collide: Dig Lists vs Dig Lists Generation)
- nav cost per tier: large sidebar 4 | notebook rail 2 (4 expanded) | small hamburger 1 | phone tabs 3
  !! notebook must be measured EXPANDED (4) - the toggle is persistent, rail is headroom not baseline
- hover-expand overlays (never pushes - else table reflows on mouse pass), 200ms in / 0 out
  gate on (hover:hover) and (pointer:fine) - notebook is a size not a device
  keyboard focus expands and does NOT auto-collapse
- toggle preference is per DEVICE not per account (32" and 13" want different answers)
- phone bottom tabs are actor-dependent: first 3 Work entries + More, no filler
- only Work entries carry counts. Documents has none - its count is "how many exist"
- watchlists = lenses, each row shows its VIEW too; counts opt-in per watchlist
  (arbitrary advanced predicate on every page load = slowest thing in the app)
- running tasks = indicator not route, popover -> links into Tasks
- Home: / RESOLVES, doesnt render. exactly 1 entry in the WHOLE sidebar -> redirect to it
  (pure My-Requests user lands straight on their requests, no 1-card page)
  more than 1 -> card page. count is across ALL groups not just Work --
  someone can have My Requests + Projects and nothing else, Work-only count buries Projects
  cards are DESTINATIONS. the actions on them (propose / generate list) are CTAs
  in the views they act on, not on Home
- permissions COMPOSE, the 5 actors are bundles not a ladder. any rule saying
  "a reader sees X" is describing a bundle and will be wrong for someone
  TODO(Permissions) added: which grant reveals which of the 14 entries
- OPEN: Work group order is Documents-first, not pipeline order. intake sits last,
  so tracing an item walks UP. keep if read as desks, switch if read as a queue.
- guests: non-library users CAN propose. they get a real account w/ VERIFIED EMAIL,
  so theyre just `reader` with no grants - created_by stays a plain FK, never null
  verified email => decisions can be EMAILED not just displayed. what goes out is the
  PUBLIC text (view-rules 4.3) - internal wording must never leave the app
  login method / attribute mapping = auth plumbing, deliberately not decided
- system-discovered docs: configurable PER PLUGIN. 2 settings - agent name, and
  entry point (proposals = through review | additions = straight in)
  BOTH paths create a request, created_by = the agent, entry point just sets
  the opening decision (Pending vs Approved). so:
    provenance uniform, no "system" placeholder
    curator tells them apart for free - the requester IS the agent name
    iteration.request_id becomes NOT NULL, the null case is gone
  agent = user record flagged non-human -> custody/authorship/log work unchanged
  TODO(Plugins): does a plugin own 1 agent or many, what happens to its past
  requests when the plugin is removed
- curator sittings: proposals and validations stay SEPARATE routes, confirmed.
  each view targets one workflow. no switcher anywhere in the map now
- Documents added to view-map Work group - the one reference page in Work,
  and the one Work entry with no count

# Pages / views and the model

- pages reorganised around pipeline stages, not entities: docs/design/shared/view-map.md
  5 work views (My Requests, Proposal Review, Additions, Validation, List Building)
  + Plan / Operate / Configure groups behind them
- My Requests is NOT a Documents view - it spans proposal/addition/document.
  needs re-homing out of documents.html, and rows should start at the proposal stage
- Validation + List Building become separate routes instead of a role switcher
- relationships pinned down exactly: docs/design/shared/entities/relationships.md
  iteration (not document) carries category, priority, project, list, status
  3 ways to reach a document: authorship, custody (category tree, inherits down), funding
  category<->project deliberately NOT related - only via intention proportions
- stage vs status resolved: docs/design/shared/entities/status-model.md
  4 stored axes (decision, eligibility, validation, progress) + derived badge
  3 gates decide admission; stage and status are both projections, neither stored
  Ready replaces Planned; Planned = future-dated list; ForbiddenOverruled = Forbidden + override
  new values needed: Withdrawn, IngestFailed (no QualityCheck - nothing sets it)
- cancellation is NOT a progress value - nullable flag beside progress, like eligibility_override
  cause = Decided | NotDigitizable (Failed folded in here - same state, different justification)
  progress preserved => resume = clear the flag, no transition table
  cancelled on a list -> list_id null -> derives back to Ready by itself
  IngestFailed stays a real position: it IS where the item is, admin retries it -> Enqueued
  stall (IngestFailed, resumable by machine) vs hold (cancellation, resumable by person)
  overview filter = derived badge, advanced filter = the axes
- validation is NOT a stored column - derived from 2 tables:
  iteration_defects (rewritten each check run) + validation_verdicts (append-only, per defect set)
  => re-check with same/fewer defects stays approved, none -> NotRequired, new one -> Needed
  => "who approved what when" comes for free
  defect_key = (plugin, rule_code, subject), value NOT part of identity - TODO(Plugins)
  plugin contract must guarantee stable rule_code, else old approvals silently invalidate
- lists are never cancelled, only deleted -> list_id cleared -> all its docs derive back to Ready
  already Digitized/Published keep it (written wins), cancelled ones stay held
  "was on list X" lives in the status log, list_id is current state not history
- resumed cancellation: flag clears completely, history goes to the status log
- re-checks run even on Digitized/Published - cant move progress back, shown as footnote
  "Published . review needed" - the one exception to one-badge-per-row
- CATALOG DRIFT was already solved by the validation model, i wrongly called it a gap.
  approvals name DEFECT KEYS, a catalog change re-runs checks, D is recomputed,
  D subset A breaks -> back to Needed showing only whats new. repaired -> verdict lapses.
  only thing actually missing was the TRIGGER - now written: ingest / scheduled run /
  the catalog sync that observes the change
  this is WHY verdicts store keys not timestamps: "approved at 14:02" cant survive an
  edit at 14:03, "approved these defects" answers by comparison every time for free
  residue (not a gap, the deliberate trade): value isnt in defect_key, so an edit that
  makes an accepted defect WORSE without changing its key keeps the acceptance
- property re-sync overwrites ITSELF (unique per document+key+source) so the old
  value is lost - a doc already on a list whose page count moves by 18 changed that
  list's capacity. so a changed value writes a STATUS LOG entry w/ source + both values.
  honest version of the old MARC-difference view: not a stored diff of every record,
  a log entry wherever a change moved a number VERA acts on
- view-rules updated for all of the above:
  new 1.3 rule 5 - a REMEMBERED toggle counts at its expensive setting, not its default.
  notebook sidebar expands 2->4 and the pref is kept => measure notebook EXPANDED.
  all 3 notebook rows restated +2 (arithmetic, not re-measured). notebook/Validator
  now 17/18 - one point of slack, re-measure it first when rebuilding
  Cancel + Resume added to the action matrix (were missing entirely).
  Cancel is confirmed-like-irreversible even though Resume exists: resume gives back
  the state but not the list position, item returns as Ready
  "Add to list: Ready, Approved" -> just Ready (Approved isnt a progress value)
  6 declarations rewritten: view: my-requests /requests, view: validation /review/documents
- PERMISSIONS DONE: docs/design/shared/entities/permissions.md. all 10 TODOs closed
- ROLES ATTACH TO USERS **AND** GROUPS. effective = user_roles UNION
  (my groups -> group_roles). i first wrote users-only and that was WRONG:
  a group that grants custody but not capability only half-does the job groups
  exist for - every hire still needs a separate forgettable role grant
  THIS IS KEYCLOAKS OWN SHAPE (direct + group-inherited, unioned) which is worth
  more than any marginal improvement on it - the IdP will be the source of users
  and groups, a model that disagrees needs a translation layer thats wrong
  in some corner forever
- 3 concepts, each earns its place:
    ROLE   = unit of CHANGE ("what a curator may do" defined ONCE, not
             re-enumerated per team. else changing it = edit N groups, miss one)
    GROUP  = unit of ADMINISTRATION (1 act adds a colleague, not 1 act per capability)
    CUSTODY/PROJECT = unit of RESPONSIBILITY
  so: dont fold roles into groups, and dont keep groups scope-only
- my "capability arrives silently via a group" objection was a NAMING problem
  dressed up as a model problem. a group called "Periodicals Curators" grants
  nothing silently. the real safeguard is PROVENANCE not a narrower attach rule:
  every screen shows HOW someone came by a capability, not just that they have it
  ("curator - via Periodicals Curators"). invisible in a list of capabilities,
  obvious in a list of reasons
  and in reverse: a groups detail shows WHAT MEMBERSHIP CONFERS, so the consequence
  of adding someone is visible WHILE adding them
- OPEN: who OWNS users/groups/role-assignment - keycloak or VERA? VERA must own
  "what a role may do here" (keycloak has no notion of validation.approve) and
  custody/projects (no notion of the category tree). the other two are an
  integration question. doesnt change the model, changes what the Access page IS
- NO `own` SCOPE, but those ops ARE STILL PERMISSIONS. two-step correction:
  step 1 - "do we need ownership?" -> not as a SCOPE. a scope thats never varied
    isnt a scope (no role would ever withhold "read your own requests")
  step 2 - i then made them need NO GRANT AT ALL, which was WRONG: it removes the
    CONFIGURATION POINT. no grant = no way to say "this account sees nothing", and
    no way for a misconfigured Guest role to FAIL VISIBLY
  landing: SELF-SCOPED PERMISSIONS. they need a grant, they need no scope column,
  because "my own" isnt one option among four - authorship is how they RESOLVE
    request.create / request.read_own / request.withdraw_own / task.read_own / watch
- SYSTEM FAILS CLOSED. a user holding no roles sees NOTHING - no sidebar, no Home.
  thats correct and intended. an empty `guest` role produces an empty app that
  somebody notices in a minute, not a user who still sees My Requests because the
  page was unconditional and whose real problem surfaces weeks later
  => assigning the default role is part of PROVISIONING, not an app assumption
  => `reader` must actually BE ASSIGNED. a user with no role is not a reader
- this is the one place the model prefers a redundant-looking grant to an elegant
  absence. elegance costs nothing when config is right and HIDES THE FAILURE when
  it isnt
- request.read_own and iteration.read are DIFFERENT PERMISSIONS, not one permission
  at 2 scopes - thats what removes the "wider than own" qualification. a reader
  never sees 2 entries with the same rows because they dont hold iteration.read
- a GRANT is a permission PLUS A SCOPE: custody | project | any
  scope is on the GRANT not the permission -> validation.approve@custody is a
  curator, @any would be an admin. one permission, 2 roles, no invented
  "approve_anywhere" variants
  grants UNION across roles, no deny rule, no precedence. absence is the only "no"
  not every permission accepts every scope: addition.retry has no `own` (no owner),
  request.withdraw has no `any` (taking back someone elses ask isnt a thing)
- the 5 actors are now LITERALLY bundles - named sets of (permission, scope).
  nothing structural separates them from a role someone adds next year
  a guest = the `reader` role + no custody + no project => all scopes resolve empty.
  not a special case, just someone whose scopes are empty
- resolutions worth remembering:
  eligibility.accept@custody (curator) vs eligibility.overrule@any (ADMIN ONLY).
    a custody-scoped overrule would let a curator quietly overturn prohibitions
    inside their own subtree - exactly the act that needs someone OUTSIDE it
  addition.read@custody vs addition.retry@any -> the READ-ONLY Additions view.
    curator sees the batch + failure text, every action ABSENT not disabled
  category.grant_custody@custody = "within my own subtree". DELEGATION CANNOT
    WIDEN, because the grant you make is bounded by the grant you hold
  cancel + resume separately grantable (shipped roles hold both, but a deployment
    can have an operator who halts a runaway batch and cant restart anything)
- SIDEBAR IS BUILT FROM PERMISSIONS (permissions 5): each entry declares one,
  visible if held at ANY scope. Documents requires iteration.read WIDER THAN own -
  because `own` is already My Requests, else a reader sees 2 entries, same rows
- view-rules 5 action matrix is now a PROJECTION of the permission table, not a
  source. curator ticks = @custody, admin ticks = @any. if they disagree, the
  permission table is right
- Users & Groups drawable: 3 indexes (users, groups, roles) + 2 details + editors.
  custody edited in BOTH /access and /categories deliberately - "what can this
  person reach" vs "who is responsible for this branch", same table 2 questions
  role editor = permission x scope grid, impossible cells absent by declaration
- ALL 14 PAGES COMPOSABLE NOW. only Plugins is a shell (its detail tabs ARE the
  plugin contract)

# Rework of the rework — sizing and shape

- TIER WAS BUILT AS A COLUMN COUNT. one type scale everywhere, tiers differing
  only in which columns survived => notebook was large-minus-columns, small was
  a CROPPED notebook. nothing fitted anything and nothing zoomed
- a tier is a DISPLAY. everything in rem, root size is the one knob,
  `<html data-tier>` picks it:
    notebook 1440x900 @16px  authored here, fits the laptop
    large    1920x1200 @15px bigger screen AND a step back -> zoomed out
    small    1024x768 @16px  tablet: same type, less room, layout reflows
    phone    393x852 @16px   same again + touch-sized controls
- SCALE DOES NOT TRACK WIDTH and thats the point. small/phone are physically
  smaller panels held CLOSER -> type stays, layout gives way. large is a bigger
  panel FURTHER BACK -> type shrinks, layout gains
- large caps its measure at 64rem. more room, not longer lines
- small KEEPS THE SPLIT (1024 has room for both). only phone turns the pane
  into a sheet
- MASTER-DETAIL is the primary shape, from the originals. the flat wide tables
  were a regression: they clipped AND still couldnt say why a row was where it
  was. narrow list you scan + pane that answers in full = less width, more said
  table only where you compare rows of NUMBERS across:
    Lists, Generation (owns selection), Additions (grouped by batch), Tasks,
    Users & Groups, Plugins, Hooks
- view switcher = LENSES ON ONE VIEW, never routes to another. Documents has
  requestor / validator / digitization. between the 2 staff lenses the tab
  decides ORDER not access (hiding a fact behind a tab makes it look absent).
  the requestor lens is different in KIND - its the public reading, so the
  machinery (4 axes, tier ladder, queue) is genuinely not theirs
- TYPE WAS MEASURED, not eyeballed (tools/type.js). the originals OVERRIDE
  tailwinds stack in their own <style>, so matching tailwind was the wrong
  target. 18/600 page title, 20/600 pane title, 14/500 body (dominant by a wide
  margin), 12px secondary, 10/600 uppercase labels
  the rework had drifted to 13 and 12 everywhere -> same font family, reads as
  a different typeface
- bug worth remembering: a LIST ROW CANNOT BE AN <a>. rows carry badges that
  are themselves links (registry, catalog) and an anchor inside an anchor makes
  the parser close the outer one early - everything after the nested link falls
  OUT of the row and loses its background. .lrow is a div with role=button
- .btn never reset text-decoration, so every <a class="btn"> came out
  underlined. a link drawn as a button is a button
- THE POINT BUDGETS ARE NOW STALE, NOT JUST UNMEASURED. they were copied from
  the design docs and described a table layout; a pane is not a row. dropped
  from the pages rather than left lying. view-rules 1.4 still measures the old
  documents.html -> re-derive for master-detail, THEN measure from the DOM
