# V1 UI Event-State Mapping Asset

## Asset Metadata

- `drop-id`: `drop-v1-ui-event-state-map`
- `type`: `state-contract`
- `scope`: `well-global`
- `owner`: `orchestrator-core`

## Core Interaction Model

用户主动作只有两类：

1. `drop`：拖拽资产进入画布
2. `connect`：拖拽节点到节点建立关系

其余由 AI 自动推进。

## Core Client Events

1. `goal.origin.generated`
- payload: `wellId,title,intent,dod,constraints`
- state impact: create `drop-goal-origin-*` in `draft`

2. `goal.origin.edited`
- payload: `dropId,mode,patch`
- mode: `manual | ai-refine`
- state impact: update goal-origin -> enqueue full re-evaluation

3. `goal.origin.confirmed`
- payload: `dropId`
- state impact: set goal-origin status to `confirmed`

4. `chat.intake.captured`
- payload: `chatId,fragments`
- state impact: produce raw intent signals

5. `intent.hypothesis.updated`
- payload: `wellId,hypotheses,uncertaintyFlags`
- state impact: update first-principles intent model

6. `asset.dropped`
- payload: `source,type,rawRef,position`
- state impact: create candidate drop -> commit minimal graph entry

7. `asset.committed`
- payload: `dropId,source,roiScore`
- state impact: move candidate to committed graph

8. `relation.connected`
- payload: `fromDropId,toDropId`
- state impact: create and commit relation

9. `conflict.annotated`
- payload: `conflictSetId,items,severity`
- state impact: attach conflict markers to graph without blocking edits

10. `asset.summary.edited`
- payload: `dropId,mode,text`
- mode: `manual | ai-refine`
- state impact: update summary -> enqueue reorganize

11. `relation.removed`
- payload: `relationId`
- state impact: remove `rel-*` -> enqueue reorganize

12. `ai.suggestion.applied`
- payload: `suggestionId,targetId`
- state impact: apply AI proposed relation/summary/layout change

13. `generate.requested`
- payload: `wellId,artifactType`
- state impact: trigger pre-run conflict and intent check

14. `preflight.checked`
- payload: `runId,conflictReport,intentUncertainty,warnings`
- state impact: attach report and continue to generate flow

15. `generate.completed`
- payload: `runId,candidateId,report`
- state impact: store candidate -> update ready state

## Orchestrator States

- `goal-draft`
- `chat-intake`
- `first-principles-modeling`
- `ingesting`
- `conflict-annotating`
- `analyzing`
- `auto-organizing`
- `suggesting`
- `pre-run-checking`
- `ready-to-generate`
- `generating`
- `verifying`

## Transition Constraints

- session starts at `goal-draft`
- `generate.requested` only allowed after `goal.origin.confirmed`
- `chat.intake.captured` must flow through `intent.hypothesis.updated` before pre-run
- `asset.dropped` and `relation.connected` commit first, annotate conflicts after
- `conflict.annotated` must not block normal editing flow
- `generate.requested` always triggers `preflight.checked`
- unresolved conflicts and intent uncertainty are surfaced as warnings by default
- any asset/relation/goal/intent mutation can move state back to `analyzing`
- verification failure moves state to `suggesting`
