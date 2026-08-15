# Issue tracker: GitHub Issues

Issues live in the `fw6/comic` GitHub repository, managed with the `gh` CLI. Engineering skills (`to-tickets`, `to-spec`, `wayfinder`, …) read and write issues here.

PRs are **not** used as a request surface (tracker flag: off).

## Wayfinding operations

The wayfinder skill expresses its map on this tracker as follows.

- **Map** — a single open issue labelled `wayfinder:map`, titled `wayfinder: <destination>`. The map is an index, not a store: it lists decisions and links their tickets; it does not list open tickets.
- **Tickets** — child issues of the map, one per open decision, each labelled `wayfinder:<type>` (`research`, `prototype`, `grilling`, `task`). Each ticket body starts with `## Question`, then a `## Part of` line pointing at the map issue by number, then a `## Blocking / Blocked by` section.
- **Child-of** — GitHub has no native parent-child, so tickets reference the map with `Part of: #<map>` in their body.
- **Blocking** — GitHub has no native blocking, so dependencies use a body convention: a ticket lists `Blocked by: #<n>` (and optionally `Blocks: #<n>`). A ticket is **unblocked** when every issue it references as blocked-by is closed.
- **Claiming** — a session claims a ticket by assigning it (to the dev driving the map) before starting work; an open, unassigned ticket is unclaimed.
- **Resolution** — the answer is recorded as a comment on the ticket, the ticket is closed, and a one-line gist is appended to the map's `## Decisions so far` with a link to the ticket.
- **Frontier query**:

  ```
  gh issue list --repo fw6/comic --state open --search 'label:"wayfinder:prototype" OR label:"wayfinder:research" OR label:"wayfinder:grilling" OR label:"wayfinder:task"'
  ```

  Note: do not use the `-l a,b,c` form — GitHub treats comma-separated label values as AND (an issue must carry every label), so that query silently matches nothing. `--search` with explicit `OR` qualifiers is the working form.

  The frontier is the subset of that list whose `Blocked by` refs are all closed.
