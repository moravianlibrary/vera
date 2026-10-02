/* VERA — the workflows as data.
   One state machine per thing that has a lifecycle. Every transition says
   who causes it and, for a person, the permission, the page it is offered
   on, and the marker that finds it in that page's demo script. check.js
   proves the graph is connected and that the design, the roles and the
   demo agree; model.html draws it.

   A transition:
     id      unique within the machine
     from    a state, or null for "comes into existence"
     to      a state
     label   what it is called on the page
     by      'person' · 'system' (time, a derived rule) · 'plugin:<Kind>'
     perm    for a person — the permission, as `key` or `key@scope`
     page    for a person — the sidebar entry (vera-ui NAV id) it is offered on
     marker  for a person — a string the page's script must contain
     logs    what the status log records (status-log.md §3)
     hook    the hook event it fires, if any (vera-data HOOK_EVENTS)
     ref     where the design decides it
   `actions` are acts that change a record without moving it between
   states — edits, retries — checked the same way.

   Sources: status-model.md, flows.md, projects.md, intentions.md §2,
   identity.md, proposal-custody.md, view-catalog.md (Hooks, Tasks). */

(function (root) {
  const P = (id, from, to, label, perm, page, marker, logs, extra) =>
    Object.assign({ id, from, to, label, by: 'person', perm, page, marker, logs }, extra || {});
  const S = (id, from, to, label, logs, extra) =>
    Object.assign({ id, from, to, label, by: 'system', logs }, extra || {});
  const G = (kind, id, from, to, label, logs, extra) =>
    Object.assign({ id, from, to, label, by: 'plugin:' + kind, logs }, extra || {});

  const machines = [

    /* ------------------------------------------------ request.decision */
    { id: 'request', name: 'Request — decision', of: 'request.decision',
      ref: 'status-model §2 Decision, §2.7, §2.8',
      states: {
        Pending:   { label: 'Pending', initial: true },
        Approved:  { label: 'Approved', next: 'progress' },
        Denied:    { label: 'Declined', terminal: true },
        Withdrawn: { label: 'Withdrawn', terminal: true },
        Following: { label: 'Following', terminal: true, note: 'asked for work already moving — follows it' }
      },
      transitions: [
        P('propose', null, 'Pending', 'Propose', 'request.create', 'documents', 'proposeBtn', 'request created', { hook: 'request.created', ref: 'flows I1' }),
        P('approve-now', null, 'Pending', 'Propose with approve now', 'request.decide@custody', 'documents', 'Approve now', 'proposed, approval requested', { ref: 'status-model §2.8' }),
        G('Harvester', 'harvest', null, 'Pending', 'Harvested by an agent', 'request created, by the agent', { hook: 'request.created', ref: 'view-map §6' }),
        P('ask-too', null, 'Following', 'Ask for this too', 'request.create', 'documents', 'data-ask', 'asked for, following', { ref: 'status-model §2.7' }),
        P('approve', 'Pending', 'Approved', 'Approve', 'request.decide@custody', 'proposals', 'data-approve', 'request decided', { hook: 'request.decided', ref: 'flows D1' }),
        P('bulk-approve', 'Pending', 'Approved', 'Approve batch', 'request.decide@custody', 'proposals', 'data-bulk', 'request decided', { hook: 'request.decided', ref: 'flows D4' }),
        P('project-approve', 'Pending', 'Approved', 'Approve the project', 'project.decide@any', 'projects', 'data-approve', 'project approved', { hook: 'request.decided', ref: 'projects §2' }),
        S('approve-on-check', 'Pending', 'Approved', 'Checks found no copy', 'approved after checks', { hook: 'request.decided', ref: 'status-model §2.8' }),
        S('held', 'Pending', 'Pending', 'Checks found a copy — held', 'held: a copy exists', { hook: 'request.held', loop: true }),
        P('decline', 'Pending', 'Denied', 'Decline', 'request.decide@custody', 'proposals', 'data-decline', 'request decided', { hook: 'request.decided', ref: 'flows D2' }),
        P('project-reject', 'Pending', 'Denied', 'Reject the project', 'project.decide@any', 'projects', 'data-reject', 'project rejected', { hook: 'request.decided', ref: 'flows D12' }),
        P('withdraw', 'Pending', 'Withdrawn', 'Withdraw', 'request.withdraw_own', 'documents', 'Withdraw', 'request withdrawn', { ref: 'status-model §6' })
      ] },

    /* ------------------------------------------------ iteration.progress */
    { id: 'progress', name: 'Iteration — progress', of: 'iteration.progress',
      ref: 'status-model §2 Progress, §3 gates',
      states: {
        Enqueued:     { label: 'Enqueued', initial: true, from: 'request.Approved' },
        IngestFailed: { label: 'Could not be added' },
        Ready:        { label: 'Ready' },
        Planned:      { label: 'Planned' },
        InProgress:   { label: 'In progress' },
        Digitized:    { label: 'Digitized' },
        Published:    { label: 'Published', terminal: true }
      },
      transitions: [
        S('ingest', null, 'Enqueued', 'Ingest, on approval', 'ingested', { hook: 'iteration.ingested', ref: 'status-model §2.8' }),
        G('Catalog adapter', 'ingest-fail', 'Enqueued', 'IngestFailed', 'Adapter errors', 'ingest failed', { hook: 'iteration.ingest_failed' }),
        P('retry', 'IngestFailed', 'Enqueued', 'Retry', 'addition.retry', 'documents', 'Retry', 'ingest retried', { ref: 'decided: no delete addition' }),
        S('gates-pass', 'Enqueued', 'Ready', 'Every gate passes', 'ready', { ref: 'status-model §3' }),
        S('gate-fails', 'Ready', 'Enqueued', 'A gate fails again', 'back to enqueued', { ref: 'flows V14' }),
        P('list-later', 'Ready', 'Planned', 'Put on a future list', 'list.edit', 'lists', 'data-mv', 'listed', { hook: 'iteration.listed' }),
        P('list-now', 'Ready', 'InProgress', 'Put on a running list', 'list.edit', 'lists', 'data-mv', 'listed', { hook: 'iteration.listed' }),
        S('list-starts', 'Planned', 'InProgress', 'The list starts', 'derived from the date', { ref: 'status-model §2' }),
        P('take-off', 'Planned', 'Ready', 'Take off the list', 'list.edit', 'lists', 'Take off', 'taken off'),
        P('take-off-running', 'InProgress', 'Ready', 'Take off the list', 'list.edit', 'lists', 'Take off', 'taken off'),
        P('list-deleted', 'Planned', 'Ready', 'Delete the list', 'list.delete', 'lists', 'data-del', 'list deleted', { hook: 'list.deleted' }),
        P('list-deleted-running', 'InProgress', 'Ready', 'Delete the list', 'list.delete', 'lists', 'data-del', 'list deleted', { hook: 'list.deleted' }),
        P('mark-done', 'InProgress', 'Digitized', 'Mark the list Done', 'list.edit', 'lists', 'data-done', 'digitized', { hook: 'iteration.digitized', ref: 'decided: Done is an act' }),
        P('publish', 'Digitized', 'Published', 'Set where it is available', 'iteration.publish@custody', 'documents', 'data-publish', 'published', { hook: 'iteration.published', ref: 'flows P1' })
      ],
      actions: [
        P('reclassify-doc', null, null, 'Reclassify — Documents', 'iteration.classify@custody', 'documents', 'data-reclassify', 'category or priority changed', { hook: 'iteration.classified' }),
        P('reclassify-val', null, null, 'Reclassify — Validations', 'iteration.classify@custody', 'validation', 'data-act', 'category or priority changed', { hook: 'iteration.classified', ref: 'flows V13' }),
        P('relink', null, null, 'Relink catalog record', 'iteration.relink', 'documents', 'data-relink', 'relinked', { hook: 'document.relinked' }),
        P('edit-descriptive', null, null, 'Edit descriptive metadata', 'iteration.edit_descriptive', 'documents', 'data-editmeta', 'metadata changed'),
        P('change-link', null, null, 'Change where it is available', 'iteration.publish@custody', 'documents', 'data-publish', 'link changed'),
        G('Property source', 'property', null, null, 'A property source answers differently', 'property changed', { hook: 'document.property_changed' }),
        G('Registry', 'registry', null, null, 'A registry answers differently', 'registry state changed', { hook: 'document.registry_changed' })
      ] },

    /* ------------------------------------------------ cancellation */
    { id: 'cancellation', name: 'Iteration — cancellation', of: 'iteration.cancellation',
      ref: 'status-model §2.5',
      states: {
        None:           { label: 'not held', initial: true },
        Cancelled:      { label: 'Cancelled' },
        NotDigitizable: { label: 'Could not be digitized' }
      },
      transitions: [
        P('cancel-doc', 'None', 'Cancelled', 'Cancel — Documents', 'iteration.cancel@custody', 'documents', 'Cancel…', 'cancelled', { hook: 'iteration.cancelled' }),
        P('cancel-list', 'None', 'Cancelled', 'Cancel — from a list', 'iteration.cancel@custody', 'lists', 'data-cancel', 'cancelled', { hook: 'iteration.cancelled', ref: 'decided: cancel from a list' }),
        P('not-digitizable', 'None', 'NotDigitizable', 'Could not be digitized', 'list.edit', 'lists', 'data-nd', 'could not be digitized', { hook: 'iteration.cancelled', ref: 'decided 2026-09-26' }),
        P('resume', 'Cancelled', 'None', 'Resume', 'iteration.resume@custody', 'documents', "'Resume'", 'resumed'),
        P('resume-nd', 'NotDigitizable', 'None', 'Resume', 'iteration.resume@custody', 'documents', "'Resume'", 'resumed')
      ] },

    /* ------------------------------------------------ restriction */
    { id: 'restriction', name: 'Restriction', of: 'iteration.restriction',
      ref: 'status-model §2 Restriction',
      states: {
        None:      { label: 'nothing forbids it', initial: true },
        Forbidden: { label: 'Forbidden' },
        Overruled: { label: 'Forbidden · overruled' }
      },
      transitions: [
        G('Restriction', 'forbid', 'None', 'Forbidden', 'A rule forbids it', 'forbidden by rule', { hook: 'iteration.restricted', ref: 'decided: only rules forbid' }),
        G('Restriction', 'clear', 'Forbidden', 'None', 'A re-check no longer finds it', 'restriction cleared', { ref: 'flows V12' }),
        P('overrule', 'Forbidden', 'Overruled', 'Overrule restriction', 'restriction.overrule@any', 'documents', 'Overrule restriction', 'restriction overruled'),
        G('Restriction', 'clear-overruled', 'Overruled', 'None', 'A re-check no longer finds it', 'restriction cleared')
      ],
      actions: [
        P('message-admins', null, null, 'Message admins', null, 'validation', 'data-msg-admins', null, { ref: 'messaging §3', noPerm: true })
      ] },

    /* ------------------------------------------------ validation */
    { id: 'validation', name: 'Validation', of: 'derived: defects ∖ verdicts',
      ref: 'status-model §2 Validation',
      states: {
        NotRequired: { label: 'no defect', initial: true },
        Needed:      { label: 'Review needed' },
        Approved:    { label: 'Accepted' },
        Denied:      { label: 'Denied in review' }
      },
      transitions: [
        G('Validation', 'defect', 'NotRequired', 'Needed', 'A check finds a defect', 'defects found', { hook: 'iteration.validated' }),
        G('Validation', 'fixed', 'Needed', 'NotRequired', 'A re-check finds nothing', 'defects cleared'),
        P('accept', 'Needed', 'Approved', 'Accept', 'validation.approve@custody', 'validation', 'data-accept', 'validation approved', { hook: 'iteration.validated' }),
        P('deny', 'Needed', 'Denied', 'Deny', 'validation.deny@custody', 'validation', 'data-deny', 'validation denied', { hook: 'iteration.validated' }),
        P('revoke', 'Approved', 'Needed', 'Revoke', 'validation.revoke@custody', 'validation', 'data-revoke', 'approval revoked'),
        G('Validation', 'new-defect', 'Approved', 'Needed', 'A re-check finds a new defect', 'defects found'),
        G('Validation', 'approved-gone', 'Approved', 'NotRequired', 'The accepted defects are gone', 'defects cleared'),
        G('Validation', 'denial-lapses', 'Denied', 'NotRequired', 'The denied defect is fixed', 'denial lapsed')
      ],
      actions: [
        P('fix', null, null, 'Fix the field, re-check', 'iteration.edit_descriptive', 'validation', 'data-fix', 'metadata changed')
      ] },

    /* ------------------------------------------------ project */
    { id: 'project', name: 'Project — decision', of: 'project.state',
      ref: 'projects §2',
      states: {
        Proposed: { label: 'Proposed', initial: true },
        Approved: { label: 'Approved' },
        Rejected: { label: 'Rejected' },
        Deleted:  { label: 'Deleted', terminal: true }
      },
      transitions: [
        P('create', null, 'Proposed', 'New project', 'project.create', 'projects', 'data-new', 'project created', { ref: 'flows PJ1' }),
        P('approve', 'Proposed', 'Approved', 'Approve', 'project.decide@any', 'projects', 'data-approve', 'project approved'),
        P('reject', 'Proposed', 'Rejected', 'Reject', 'project.decide@any', 'projects', 'data-reject', 'project rejected'),
        P('delete-proposed', 'Proposed', 'Deleted', 'Delete, while empty', 'project.delete@managed', 'projects', 'data-del', 'project deleted'),
        P('delete-approved', 'Approved', 'Deleted', 'Delete, while empty', 'project.delete@managed', 'projects', 'data-del', 'project deleted'),
        P('delete-rejected', 'Rejected', 'Deleted', 'Delete, while empty', 'project.delete@managed', 'projects', 'data-del', 'project deleted')
      ],
      final: ['Approved', 'Rejected'],
      actions: [
        P('edit', null, null, 'Edit details and dates', 'project.edit@managed', 'projects', 'data-edit', 'details or dates changed', { ref: 'flows PJ2, PJ6' }),
        P('members', null, null, 'Members, hand over', 'project.manage_members@managed', 'projects', 'data-members', 'member added or removed · manager changed', { ref: 'flows PJ2, PJ4' }),
        P('message', null, null, 'Message the manager', null, 'projects', 'data-msg', null, { noPerm: true })
      ] },

    /* ------------------------------------------------ list */
    { id: 'list', name: 'Digitization list', of: 'list state',
      ref: 'status-model §2.6, decided: Done is an act',
      states: {
        Planned:    { label: 'Planned', initial: true },
        InProgress: { label: 'In progress' },
        Done:       { label: 'Done', terminal: true },
        Deleted:    { label: 'Deleted', terminal: true }
      },
      transitions: [
        P('create', null, 'Planned', 'New list', 'list.create', 'lists', 'New list', 'list created', { hook: 'list.created' }),
        P('create-now', null, 'InProgress', 'New list, starts now', 'list.create', 'lists', 'Starts now', 'list created', { hook: 'list.created' }),
        S('starts', 'Planned', 'InProgress', 'Its start date', 'derived from the date'),
        P('done', 'InProgress', 'Done', 'Mark Done', 'list.edit', 'lists', 'data-done', 'marked done'),
        P('delete-planned', 'Planned', 'Deleted', 'Delete', 'list.delete', 'lists', 'data-del', 'list deleted', { hook: 'list.deleted' }),
        P('delete-running', 'InProgress', 'Deleted', 'Delete', 'list.delete', 'lists', 'data-del', 'list deleted', { hook: 'list.deleted', ref: 'flows L16: never a Done one' })
      ],
      actions: [
        P('edit', null, null, 'Edit members and dates', 'list.edit', 'lists', 'edSave', 'members or dates changed', { hook: 'list.dates_changed', ref: 'flows L10' }),
        P('generate', null, null, 'Generate a draft', 'list.create', 'lists', 'genBtn', 'draft generated, with generator and inputs', { ref: 'intentions §4' }),
        P('message', null, null, 'Message the list author', null, 'documents', 'data-msg-list', null, { noPerm: true })
      ] },

    /* ------------------------------------------------ intention mix */
    { id: 'mix', name: 'Intention — its mix', of: 'distribution.owner',
      ref: 'intentions §2.1–2.5',
      states: {
        Tracks: { label: 'Tracks an owner', initial: true },
        Owns:   { label: 'Owns its mix' }
      },
      transitions: [
        P('new-tracking', null, 'Tracks', 'New intention, tracking Overall', 'intention.edit', 'intentions', 'data-new', 'intention created', { ref: 'flows M1' }),
        P('new-copy', null, 'Owns', 'New intention, own copy', 'intention.edit', 'intentions', 'c:', 'intention created', { ref: 'flows M2' }),
        P('detach-cat', 'Tracks', 'Owns', 'Detach — Categories', 'intention.edit', 'categories', 'data-detach', 'mix detached', { ref: 'flows M4' }),
        P('detach-int', 'Tracks', 'Owns', 'Own mix, copied from — Intentions', 'intention.edit', 'intentions', 'c:', 'mix detached'),
        P('track', 'Owns', 'Tracks', 'Track — moving its trackers along', 'intention.edit', 'intentions', 'inMove', 'mix tracks another', { ref: 'flows M5' }),
        P('untick', 'Tracks', 'Owns', 'Unticked when its owner saves', 'intention.edit', 'categories', 'data-tr', 'keeps the old mix', { ref: 'flows M6' })
      ],
      actions: [
        P('edit-shares', null, null, 'Edit proportions', 'intention.edit', 'categories', 'data-shares', 'mix changed', { ref: 'flows M3' }),
        P('edit-overall', null, null, 'Edit the house mix', 'intention.edit_overall@any', 'categories', 'intention.edit_overall', 'mix changed', { ref: 'decided 2026-10-01' }),
        P('archive', null, null, 'Archive', 'intention.edit', 'intentions', 'data-archive', 'archived'),
        P('repeat', null, null, 'Repeats', 'intention.repeat@any', 'intentions', 'data-tpl', 'repeat changed')
      ] },

    /* ------------------------------------------------ user access */
    { id: 'user', name: 'User — access', of: 'user roles',
      ref: 'identity §3–§4, permissions §1.1',
      states: {
        NoRole:   { label: 'No access yet', initial: true },
        HasRole:  { label: 'Has a role' },
        Disabled: { label: 'Disabled', terminal: true }
      },
      transitions: [
        G('Identity', 'first-login', null, 'NoRole', 'First login, default role none', 'user created'),
        G('Identity', 'first-login-role', null, 'HasRole', 'First login, default or mapped role', 'user created · role mapped'),
        P('local', null, 'NoRole', 'New local account', 'access.manage@any', 'access', 'data-newuser', 'user created'),
        P('grant', 'NoRole', 'HasRole', 'Roles — by hand', 'access.manage@any', 'access', 'data-uroles', 'role granted'),
        G('Identity', 'mapped', 'NoRole', 'HasRole', 'A mapping matches at login', 'role mapped'),
        P('revoke', 'HasRole', 'NoRole', 'Remove the last role', 'access.manage@any', 'access', 'data-uroles', 'role removed'),
        G('Identity', 'unmapped', 'HasRole', 'NoRole', 'The claim is gone at login', 'role removed by mapping'),
        P('disable', 'HasRole', 'Disabled', 'Disable user', 'access.manage@any', 'access', 'data-udisable', 'user disabled', { ref: 'identity §4, §5' }),
        P('disable-norole', 'NoRole', 'Disabled', 'Disable user', 'access.manage@any', 'access', 'data-udisable', 'user disabled')
      ],
      actions: [
        P('link', null, null, 'Link identity', 'access.manage@any', 'access', 'data-ulink', 'identity linked'),
        P('groups', null, null, 'Groups', 'access.manage@any', 'access', 'data-ugroups', 'member added or removed'),
        P('custody', null, null, 'Proposal custody members', 'access.manage@any', 'access', 'data-cmembers', 'custody member added or removed', { ref: 'proposal-custody §6' }),
        P('message', null, null, 'Message the user', null, 'access', 'data-msg', null, { noPerm: true })
      ] },

    /* ------------------------------------------------ hook delivery */
    { id: 'delivery', name: 'Hook — a delivery', of: 'delivery',
      ref: 'view-catalog Hooks',
      states: {
        Waiting:   { label: 'Waiting to send', initial: true },
        Sent:      { label: 'Sent', terminal: true },
        Dead:      { label: 'Gave up' },
        Discarded: { label: 'Discarded', terminal: true }
      },
      transitions: [
        S('event', null, 'Waiting', 'An event the hook listens to', null),
        G('Delivery channel', 'send', 'Waiting', 'Sent', 'Delivered', null),
        G('Delivery channel', 'give-up', 'Waiting', 'Dead', 'Last retry failed', null),
        P('send-now', 'Waiting', 'Sent', 'Send now', 'hook.configure@any', 'hooks', 'data-flush', null),
        P('retry', 'Dead', 'Waiting', 'Retry', 'hook.configure@any', 'hooks', 'data-retry', null),
        P('discard', 'Dead', 'Discarded', 'Discard', 'hook.configure@any', 'hooks', 'data-discard', null)
      ] },

    /* ------------------------------------------------ task */
    { id: 'task', name: 'Task — a run', of: 'task.state',
      ref: 'view-catalog Tasks',
      states: {
        Running:   { label: 'Running', initial: true },
        Finished:  { label: 'Finished', terminal: true },
        Failed:    { label: 'Failed' },
        Cancelled: { label: 'Cancelled' }
      },
      transitions: [
        S('scheduled', null, 'Running', 'A schedule fires', null),
        P('run-now', null, 'Running', 'Run now', 'plugin.run@any', 'plugins', 'data-run', null),
        S('finish', 'Running', 'Finished', 'Finishes', null, { hook: 'task.finished' }),
        S('fail', 'Running', 'Failed', 'Fails', null, { hook: 'task.failed' }),
        P('cancel', 'Running', 'Cancelled', 'Cancel', 'task.cancel@any', 'tasks', 'data-cancel', null),
        P('cancel-own', 'Running', 'Cancelled', 'Cancel my run', 'task.read_own', 'tasks', 'data-cancel', null),
        P('rerun', 'Failed', 'Running', 'Run again', 'plugin.run@any', 'tasks', 'data-rerun', null),
        P('rerun-cancelled', 'Cancelled', 'Running', 'Run again', 'plugin.run@any', 'tasks', 'data-rerun', null)
      ],
      actions: [
        P('pause', null, null, 'Pause a schedule', 'task.schedule@any', 'schedules', 'data-pause', null),
        P('edit-schedule', null, null, 'Edit a schedule', 'task.schedule@any', 'schedules', 'data-sched', null),
        P('retention', null, null, 'Task retention', 'task.schedule@any', 'schedules', 'data-retention', null)
      ],
      final: ['Failed', 'Cancelled'] }
  ];

  /* which demo script implements each sidebar entry */
  const SCRIPTS = { documents: 'page-documents.js', proposals: 'page-proposals.js', validation: 'page-validation.js',
    lists: 'page-lists.js', projects: 'page-projects.js', categories: 'page-categories.js', intentions: 'page-intentions.js',
    tasks: 'page-tasks.js', schedules: 'page-tasks.js', access: 'page-access.js', plugins: 'page-plugins.js', hooks: 'page-hooks.js' };

  const MODEL = { machines, SCRIPTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = MODEL;
  else root.VERA_WORKFLOWS = MODEL;
})(this);
