# Chat-to-Asset Protocol Asset

## Asset Metadata

- `drop-id`: `drop-protocol-chat-to-asset`
- `type`: `protocol`
- `scope`: `well-global`
- `owner`: `orchestrator-core`

## Intent

Use chat for intent capture.
Use asset graph for execution truth.

## Protocol

1. Chat Intake
- user expresses intent, constraints, and references in natural language

2. First-Principles Modeling
- decompose request into: objective, constraints, success criteria, non-goals
- build intent hypotheses when user intent is unclear
- keep uncertainty explicit and editable

3. Draft Structuring
- AI converts intake + hypotheses into candidate typed drops and candidate relations

4. Minimal Asset Commit
- commit high-ROI drops first
- merge or summarize redundant drops
- keep asset count intentionally low

5. Conflict Annotation After Commit
- detect contradictions across goal, constraints, references, and committed drops
- attach conflict markers and evidence to related nodes/edges
- do not block commit by default

6. Graph-First Execution
- planning, gap-check, and generation operate on committed graph
- chat history is context aid, not execution source of truth

7. Pre-Run Conflict and Intent Check
- when generation starts, run a full conflict scan
- include unresolved intent hypotheses in risk report
- allow run with explicit risk visibility

8. Continuous Re-evaluation
- any committed drop/relation change triggers re-evaluation

9. Granularity Health Check
- estimate blast radius for the current change set
- if expected blast radius is high, propose asset merge/refactor before expanding the graph

## New Rules

1. Asset Minimalism Rule
- assets should be as few as possible while preserving decision quality
- avoid creating low-information drops

2. Conflict Visibility Rule
- conflicts must be detectable and visible after commit
- conflicts are not forced to be resolved before normal editing continues
- generation phase must run conflict check and expose risk before execution

3. First-Principles Rule
- first-principles decomposition is mandatory before generation
- initial user wording is treated as signal, not final specification

4. Granularity Rule
- repeated high blast radius indicates over-fragmented assets
- prioritize decoupling and canonicalization when high blast radius persists

## Success Criteria

- lower chat rounds per milestone
- stable asset count growth
- fewer hidden contradictory assumptions
- clearer intent convergence before generation
