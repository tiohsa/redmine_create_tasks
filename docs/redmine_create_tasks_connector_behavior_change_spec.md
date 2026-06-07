# Change Specification: Replace Relation Mode with Handle-Based Dependency and Child Issue Creation

## 1. Target Repository

- Repository: `tiohsa/redmine_create_tasks`
- Target branch: `main`
- Application area: Redmine plugin frontend and issue registration backend

## 2. Background

The current implementation supports a global registration setting called `relation_mode`, which switches the entire task map between the following behaviors:

- Register the mind map hierarchy as Redmine parent-child issues.
- Register the mind map hierarchy as Redmine dependency relations.

This global mode is no longer desirable because the user operation itself should determine the relationship type.

The new behavior must remove the global relation mode and instead interpret relationships based on the UI handle used:

- The left-side plus handle represents a dependency relationship.
- The bottom-side plus handle represents a Redmine child issue relationship.
- The right-side plus handle is not used and should be removed unless a clear future use case is added.

## 3. Goal

Implement a handle-based relationship model where:

1. Nodes created from the left-side plus button are registered as dependency predecessors of the target node.
2. Existing nodes dragged onto the left-side plus handle become dependency predecessors of the target node.
3. Existing nodes dragged onto the bottom-side plus handle become child issues of the target node.
4. The registration mode selector is removed.
5. Both Redmine dependency relations and parent-child issue relations can coexist in the same task map.

## 4. Non-Goals

The following items are outside the scope of this change:

- Changing Redmine's native issue relation model.
- Adding new Redmine relation types other than `precedes`.
- Replacing the current D3-based mind map layout engine.
- Introducing React Flow or another graph library.
- Adding a database table for storing task map relationships.
- Implementing real-time collaboration.

## 5. Current Behavior Summary

### 5.1 Frontend

Current frontend behavior includes:

- `MindMapNode` has `children` and optional `direction`.
- `Connection` only has `id`, `fromId`, and `toId`.
- The left and right plus buttons add child nodes with a direction.
- The bottom circular handle currently creates a custom connection.
- Node drag currently supports moving a node under another node.

### 5.2 Registration

Current registration behavior includes:

- `relation_mode = 'dependency'` causes hierarchy to be registered as dependencies.
- `relation_mode = 'child'` causes hierarchy to be registered as parent-child issues.
- Backend skips hierarchy creation when dependency mode is enabled.

This global branch must be removed.

## 6. New Functional Requirements

## 6.1 Remove Relation Mode

### Requirement

Remove the global relation mode setting from the UI, frontend payload, and backend registration logic.

### Required changes

- Remove `relation_mode?: 'child' | 'dependency'` from `RegistrationSettings`.
- Remove the Relation Mode radio button section from `RegistrationSettingsDialog.tsx`.
- Remove `relation_mode` from `RegisterPayload.defaults` in `taskRegistrationService.ts`.
- Remove `dependency_mode?` from `IssueRegistrationService`.
- Always apply both dependency relations and hierarchy relations during registration.

### Expected backend flow

```ruby
apply_dependencies(task_list, issues_by_task, result)
apply_hierarchy(task_list, issues_by_task, result)
```

Do not skip hierarchy creation based on a global setting.

---

## 6.2 Left-Side Plus Click Creates a Dependency Node

### Requirement

Clicking the left-side plus button on a target node must create a new predecessor task node.

### Behavior

When the user clicks the left-side plus button of node `B`:

1. Create a new node `A`.
2. Place the new node visually on the left side of `B`.
3. Treat `A` as a dependency predecessor of `B`.
4. During Redmine registration, create a `precedes` relation from `A` to `B`.

### Redmine mapping

```text
A precedes B
```

Backend issue relation:

```ruby
IssueRelation.new(
  issue_from: issue_a,
  issue_to: issue_b,
  relation_type: 'precedes'
)
```

### Implementation note

The existing `direction === 'left'` behavior can be reused in the short term. However, dependency semantics should be made explicit enough to avoid confusing left-side dependency nodes with Redmine child issues.

---

## 6.3 Dragging a Node onto the Left-Side Plus Creates a Dependency

### Requirement

Dragging an existing node onto another node's left-side plus handle must create a dependency relation.

### Behavior

When existing node `A` is dragged onto the left-side plus handle of node `B`:

1. Do not move `A` under `B` as a child issue.
2. Create or update an explicit dependency relation where `A` precedes `B`.
3. Visually render the dependency relation in a way that is distinguishable from parent-child hierarchy lines.
4. During Redmine registration, include `A` in `B.dependencies`.

### Redmine mapping

```text
A precedes B
```

### Validation rules

The operation must be rejected if:

- `A` and `B` are the same node.
- The dependency already exists.
- The reverse dependency already exists and would create a direct cycle.
- The dependency would create a cycle in the dependency graph.
- The relation would duplicate a parent-child relationship between the same pair of nodes.

### Data model recommendation

Extend `Connection` to distinguish dependency relations explicitly:

```ts
type ConnectionType = 'dependency';

type HandleKind = 'leftDependency' | 'bottomChild';

interface Connection {
  id: string;
  fromId: string;
  toId: string;
  type: ConnectionType;
  sourceHandle?: HandleKind;
  targetHandle?: HandleKind;
}
```

For this change, only dependency connections need to remain in `connections`. Parent-child relationships should preferably be represented by the existing `children` tree.

---

## 6.4 Dragging a Node onto the Bottom Plus Creates a Child Issue

### Requirement

Dragging an existing node onto another node's bottom plus handle must make the dragged node a child issue of the target node.

### Behavior

When existing node `A` is dragged onto the bottom plus handle of node `B`:

1. Move `A` under `B` in the internal tree structure.
2. Do not create a dependency relation.
3. During Redmine registration, set `A.parent_task_id = B`.
4. Re-render the mind map as a parent-child hierarchy.

### Redmine mapping

```text
A.parent_task_id = B
```

### Implementation note

Prefer reusing the existing node move operation:

```ts
onMoveNode(draggedNodeId, targetNodeId)
```

This keeps the visual tree, in-memory model, and Redmine parent-child registration aligned.

### Validation rules

The operation must be rejected if:

- The dragged node is the root node.
- The target node is the dragged node itself.
- The target node is a descendant of the dragged node.
- The operation would create a parent-child cycle.
- The same pair already has a dependency relation that would conflict with the hierarchy.

---

## 6.5 Remove or Disable the Right-Side Plus

### Requirement

The right-side plus button is not part of the new relationship model and should be removed from the UI unless a clear behavior is defined.

### Recommended decision

Remove the right-side plus button from the initial implementation.

### Rationale

The new model has a clear operation-to-meaning mapping:

| UI operation | Meaning |
|---|---|
| Left-side plus | Dependency predecessor |
| Bottom plus | Child issue |

The right-side plus would introduce ambiguity because it does not map to either required Redmine relationship.

---

## 7. Data Model Changes

## 7.1 MindMapNode

No mandatory structural change is required for parent-child relationships because `children` already represents hierarchy.

Existing fields can continue to be used:

```ts
interface MindMapNode {
  id: string;
  text: string;
  startDate?: string;
  endDate?: string;
  effort?: number;
  children: MindMapNode[];
  direction?: 'left' | 'right';
}
```

However, new code should avoid relying on `direction: 'right'` for future behavior because the right-side plus is being removed.

## 7.2 Connection

Change `Connection` from an untyped edge to a typed dependency relation.

Current:

```ts
interface Connection {
  id: string;
  fromId: string;
  toId: string;
}
```

Proposed:

```ts
interface Connection {
  id: string;
  fromId: string;
  toId: string;
  type: 'dependency';
  sourceHandle?: 'leftDependency';
  targetHandle?: 'leftDependency';
}
```

### Compatibility rule

Existing saved connections without `type` must be treated as dependency connections.

```ts
const normalizedType = connection.type ?? 'dependency';
```

---

## 8. Registration Payload Changes

## 8.1 Remove `relation_mode`

Remove `relation_mode` from the registration defaults payload.

Current payload behavior:

```ts
defaults: {
  relation_mode?: 'child' | 'dependency';
}
```

New payload behavior:

```ts
defaults: {
  tracker_id?: string;
  assigned_to_id?: string;
  status_id?: string;
  priority_id?: string;
  category_id?: string;
  create_root_issue?: boolean;
  existing_root_issue_id?: string;
}
```

## 8.2 Task payload

Each task may include both dependency and hierarchy information:

```ts
{
  id: string;
  subject: string;
  start_date?: string;
  due_date?: string;
  man_days?: number;
  dependencies?: string[];
  parent_task_id?: string;
}
```

This allows a task to be both:

- A child issue of another issue.
- Dependent on one or more predecessor issues.

---

## 9. Dependency and Hierarchy Construction Rules

## 9.1 Dependency map

The dependency map must be built from:

1. Nodes created from the left-side plus button.
2. Existing nodes dragged onto a left-side plus handle.
3. Existing custom connections migrated from older saved data.

For a dependency relation `A -> B`:

```text
B.dependencies includes A
```

## 9.2 Parent map

The parent map must be built from the `children` tree.

For a hierarchy relation `B has child A`:

```text
A.parent_task_id = B
```

## 9.3 Root handling

Existing root handling must be preserved:

- If root issue creation is enabled, root can be created as a new Redmine issue.
- If an existing root issue ID is configured, children of root should use that existing issue ID as their parent.
- If root issue creation is disabled and no existing root issue ID exists, root children should not receive a root parent ID.

---

## 10. UI Behavior Specification

## 10.1 Node handles

Each node should expose the following handles:

| Handle | Click behavior | Drag/drop behavior | Relationship |
|---|---|---|---|
| Left plus | Create new dependency predecessor | Existing node becomes predecessor | Dependency |
| Bottom plus | Optional: create new child issue | Existing node becomes child | Parent-child |
| Right plus | None | None | Remove |

## 10.2 Visual distinction

Dependency relations and hierarchy relations must be visually distinguishable.

Recommended style:

| Relation | Visual style |
|---|---|
| Parent-child | Existing tree link style |
| Dependency | Curved or dashed connector with arrow direction |

The dependency arrow direction must indicate:

```text
predecessor -> successor
```

## 10.3 Drag feedback

When dragging a node:

- Hovering over a left-side plus handle should indicate dependency creation.
- Hovering over a bottom plus handle should indicate child issue creation.
- Invalid drop targets should be visually rejected.

Recommended labels or tooltips:

- Left plus: `Add dependency predecessor`
- Bottom plus: `Make child issue`

---

## 11. Backend Changes

## 11.1 IssueRegistrationService

### Remove

Remove the following method:

```ruby
def dependency_mode?(defaults)
  defaults[:relation_mode]&.to_s == 'dependency'
end
```

### Change registration flow

Current behavior:

```ruby
apply_dependencies(task_list, issues_by_task, result)
apply_hierarchy(task_list, issues_by_task, result) unless dependency_mode?(defaults)
```

New behavior:

```ruby
apply_dependencies(task_list, issues_by_task, result)
apply_hierarchy(task_list, issues_by_task, result)
```

## 11.2 Dependency creation

Keep the existing `precedes` relation creation behavior.

The backend should continue to skip duplicate dependency relations when the same `precedes` relation already exists.

## 11.3 Hierarchy creation

Keep the existing `parent_task_id` resolution behavior.

The backend should continue to support:

- Parent issues created in the same registration batch.
- Existing external parent issue IDs.
- Warning when an external parent issue does not exist.
- Warning when an external parent issue is closed.

---

## 12. Migration and Compatibility

## 12.1 Saved localStorage data

Existing localStorage task maps may contain:

- `connections` without `type`.
- Nodes with `direction: 'left'` or `direction: 'right'`.
- Existing `registrationSettings.relation_mode`.

### Migration rules

1. Ignore and remove `registrationSettings.relation_mode` when saving settings again.
2. Treat existing untyped `connections` as dependency relations.
3. Continue treating `direction: 'left'` nodes as dependency predecessors.
4. Do not automatically convert `direction: 'right'` nodes into child issues unless they already exist in the `children` tree.
5. Preserve existing tree structure to avoid data loss.

## 12.2 Backward compatibility risk

Existing maps created under child mode may have used the tree hierarchy as child issues. Existing maps created under dependency mode may have used the tree hierarchy as dependencies.

Because `relation_mode` is being removed, this can alter registration semantics for old saved maps.

Recommended mitigation:

- On first load after this change, normalize old data conservatively.
- Treat left-side nodes as dependency predecessors.
- Treat non-left tree children as child issues only if they are already in the hierarchy.
- Consider showing a one-time notice: `Relation mode has been removed. Left-side nodes are dependencies; bottom hierarchy represents child issues.`

---

## 13. Validation Rules

The frontend must validate the following before creating a dependency or child relationship:

| Case | Required behavior |
|---|---|
| Self dependency | Reject |
| Self parent-child | Reject |
| Duplicate dependency | Reject or ignore |
| Reverse dependency exists | Reject |
| Dependency cycle | Reject |
| Parent-child cycle | Reject |
| Drag root as child | Reject |
| Move parent under descendant | Reject |
| Same pair has conflicting relation | Reject or ask user to remove existing relation first |

Backend should remain defensive and preserve warnings for invalid Redmine-level parent or dependency references.

---

## 14. Testing Requirements

## 14.1 Frontend unit tests

Add tests for:

1. Left-side plus click creates a dependency predecessor node.
2. Dragging node `A` to node `B` left plus creates dependency `A -> B`.
3. Dragging node `A` to node `B` bottom plus moves `A` under `B`.
4. Right-side plus is not rendered.
5. Existing untyped connections are treated as dependency connections.
6. `relation_mode` is not included in the registration payload.
7. Dependency cycles are rejected.
8. Parent-child cycles are rejected.

## 14.2 Backend unit tests

Add or update tests for:

1. Registering a task with both `dependencies` and `parent_task_id`.
2. Backend always applies dependencies and hierarchy in the same registration call.
3. `relation_mode` is ignored if accidentally included in the payload.
4. Duplicate `precedes` relations are not recreated.
5. Existing external parent issue still works.
6. Closed external parent issue still generates a warning and does not set parent.

## 14.3 Manual test scenarios

### Scenario 1: Create dependency from left plus

1. Select node `B`.
2. Click the left plus.
3. Create node `A`.
4. Register issues.
5. Verify Redmine has `A precedes B`.
6. Verify `A` is not registered as a child issue of `B`.

### Scenario 2: Drag dependency onto left plus

1. Create nodes `A` and `B`.
2. Drag `A` onto `B`'s left plus.
3. Register issues.
4. Verify Redmine has `A precedes B`.

### Scenario 3: Drag child onto bottom plus

1. Create nodes `A` and `B`.
2. Drag `A` onto `B`'s bottom plus.
3. Register issues.
4. Verify `A.parent_id == B.id` in Redmine.
5. Verify no `A precedes B` relation was created.

### Scenario 4: Mixed relationship map

1. Create node `B`.
2. Add dependency predecessor `A` using the left plus.
3. Add child issue `C` using the bottom plus.
4. Register issues.
5. Verify:
   - `A precedes B`
   - `C.parent_id == B.id`

---

## 15. Recommended Implementation Order

1. Remove `relation_mode` from frontend settings UI and payload.
2. Remove `dependency_mode?` backend branching and always apply both dependency and hierarchy.
3. Extend or normalize `Connection` to represent dependency connections explicitly.
4. Update left-side plus click behavior to create dependency predecessor nodes.
5. Add left-side plus drop behavior for dependency creation.
6. Change bottom plus drop behavior to call the existing node move logic.
7. Remove the right-side plus UI.
8. Update dependency and parent map construction in registration payload generation.
9. Add frontend and backend tests.
10. Update README or usage documentation.

---

## 16. Acceptance Criteria

The change is complete when all the following are true:

- The registration settings dialog no longer shows Relation Mode.
- The registration payload no longer sends `relation_mode`.
- Backend no longer branches on `relation_mode`.
- Left-side plus click creates a dependency predecessor node.
- Dragging a node onto the left-side plus creates a dependency relation.
- Dragging a node onto the bottom plus creates a parent-child relation.
- Right-side plus is removed or hidden.
- One task map can register both Redmine dependency relations and parent-child issue relations.
- Existing saved untyped connections are treated as dependencies.
- Tests cover both dependency and parent-child registration in the same operation.

## 17. Key Design Decision

The preferred design is:

- Keep Redmine child issue relationships in the existing `children` tree.
- Keep cross-node dependency relationships in typed `connections`.
- Remove the global relation mode entirely.

This keeps the visual model, frontend data model, and Redmine registration model aligned.
