# Change Specification: Render Dependency Lines as Left-to-Right Arrows

## 1. Target Repository and Branch

- Repository: `tiohsa/redmine_create_tasks`
- Target branch: `improve-node-function`
- Main target file: `frontend/components/MindMapCanvas.tsx`

## 2. Background

The `improve-node-function` branch separates dependency relationships from child-ticket relationships.

The intended behavior is:

- The left-side `+` creates or receives dependency-source tasks.
- The bottom `+` is used for child-ticket relationships.
- Dependency relationships are represented by `Connection` objects.
- Child-ticket relationships are represented by the `children` tree structure.

Currently, dependency lines are drawn using the center point of the source node and the center point of the target node. This makes the dependency direction less clear visually.

The dependency line should instead be rendered as a clear left-to-right arrow:

```text
[Dependency Source] ─────▶ [Dependency Target]
```

The arrow direction must represent the Redmine `precedes` relation:

```text
conn.fromId precedes conn.toId
```

## 3. Problem Statement

The current dependency connector path is calculated approximately as follows:

```tsx
const from = getNodePos(conn.fromId);
const to = getNodePos(conn.toId);
const dx = to.x - from.x;
const midX = from.x + dx / 2;
const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
```

This creates a center-to-center curve.

Issues:

1. The arrow appears to connect node centers rather than node edges.
2. The arrow direction is visually weaker than expected.
3. The line may visually pass through nodes.
4. The connector does not clearly communicate `fromId -> toId` as a left-to-right dependency.

## 4. Required Behavior

### 4.1 Dependency Arrow Direction

Dependency connectors must be rendered from:

```text
right edge of source node -> left edge of target node
```

Where:

- Source node = `conn.fromId`
- Target node = `conn.toId`
- Meaning = source task precedes target task

### 4.2 Visual Style

Dependency connectors should remain visually distinct from child-ticket hierarchy lines.

Required style:

- Directional arrow head at the target side
- Dashed line is allowed and preferred
- No arrow head at the source side
- Do not reuse hierarchy-link styling if it makes dependency and child-ticket lines ambiguous

Recommended style:

```tsx
markerEnd="url(#dependency-arrow)"
strokeDasharray="8 6"
```

### 4.3 Hierarchy Lines Must Not Be Changed

This change must not alter normal child-ticket hierarchy lines.

The following must remain separate:

| Relationship | Source data | Rendering |
|---|---|---|
| Dependency | `connections` | Left-to-right dashed arrow |
| Child ticket | `children` tree | Normal hierarchy line |

## 5. Detailed Implementation Design

### 5.1 Add Anchor-Based Path Calculation

Replace center-to-center dependency line calculation with edge-to-edge anchor calculation.

Recommended implementation:

```tsx
const DEPENDENCY_NODE_GAP = 8;
const MIN_DEPENDENCY_CURVE = 80;

const from = getNodePos(conn.fromId);
const to = getNodePos(conn.toId);

const start = {
  x: from.x + NODE_WIDTH / 2 + DEPENDENCY_NODE_GAP,
  y: from.y,
};

const end = {
  x: to.x - NODE_WIDTH / 2 - DEPENDENCY_NODE_GAP,
  y: to.y,
};

const midX = start.x + Math.max(MIN_DEPENDENCY_CURVE, (end.x - start.x) / 2);

const path = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
```

### 5.2 Handle Unexpected Layout Cases

The desired visual result assumes the dependency source is positioned to the left of the dependency target.

However, defensive handling should be added because existing data or manual movement could produce a case where the source is not visually left of the target.

Recommended behavior:

```tsx
const isLeftToRight = from.x <= to.x;

const start = isLeftToRight
  ? { x: from.x + NODE_WIDTH / 2 + DEPENDENCY_NODE_GAP, y: from.y }
  : { x: from.x - NODE_WIDTH / 2 - DEPENDENCY_NODE_GAP, y: from.y };

const end = isLeftToRight
  ? { x: to.x - NODE_WIDTH / 2 - DEPENDENCY_NODE_GAP, y: to.y }
  : { x: to.x + NODE_WIDTH / 2 + DEPENDENCY_NODE_GAP, y: to.y };
```

Then calculate the curve using the direction-aware control points.

Preferred option:

- Preserve left-to-right dependency layout in `buildTreeLayout`.
- Use fallback edge anchoring only as a defensive measure.

### 5.3 Adjust Arrow Marker if Needed

The current marker can be retained if it aligns correctly with the new endpoint.

If the arrow head overlaps the target node, adjust `refX`, `markerWidth`, or endpoint gap.

Recommended marker definition:

```tsx
<marker
  id="dependency-arrow"
  markerWidth="8"
  markerHeight="8"
  refX="7"
  refY="4"
  orient="auto"
  markerUnits="strokeWidth"
>
  <path d="M 0 0 L 8 4 L 0 8 z" className="fill-sky-600" />
</marker>
```

If the arrow appears too close to the target node, first increase `DEPENDENCY_NODE_GAP` before changing the marker geometry.

## 6. Files to Modify

### 6.1 `frontend/components/MindMapCanvas.tsx`

Modify the dependency connector rendering inside the `connections.map(...)` block.

Expected changes:

- Replace center-to-center path calculation.
- Introduce source and target anchor points.
- Keep `markerEnd="url(#dependency-arrow)"`.
- Keep dependency arrows separate from hierarchy links.
- Do not change `onMoveNode` behavior for child-ticket operations.

### 6.2 Optional: Add Utility Function

To reduce duplication and make the behavior testable, consider extracting the path calculation:

```tsx
const buildDependencyArrowPath = (
  from: { x: number; y: number },
  to: { x: number; y: number }
): string => {
  const gap = 8;
  const minCurve = 80;

  const start = {
    x: from.x + NODE_WIDTH / 2 + gap,
    y: from.y,
  };

  const end = {
    x: to.x - NODE_WIDTH / 2 - gap,
    y: to.y,
  };

  const midX = start.x + Math.max(minCurve, (end.x - start.x) / 2);
  return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
};
```

## 7. Non-Goals

This change must not include:

- Changing Redmine issue registration behavior
- Changing dependency semantics
- Changing child-ticket creation behavior
- Reintroducing `relation_mode`
- Changing the bottom `+` behavior
- Reintroducing the right-side `+` if it is not used
- Converting all hierarchy lines into dependency arrows

## 8. Compatibility Requirements

Existing `connections` data must continue to work.

If a connection lacks an explicit `type`, it should continue to be treated as a dependency:

```tsx
(conn.type ?? 'dependency') === 'dependency'
```

This is required for compatibility with existing local storage data and previously exported JSON.

## 9. Acceptance Criteria

### 9.1 Visual Acceptance Criteria

- A dependency from node A to node B is rendered as an arrow from A to B.
- The arrow starts near the right edge of A, not the center of A.
- The arrow ends near the left edge of B, not the center of B.
- The arrow head points to B.
- The dependency line does not look like a child-ticket hierarchy line.
- Child-ticket hierarchy lines remain visually unchanged.

### 9.2 Functional Acceptance Criteria

- Creating a dependency using the left-side `+` still creates `conn.fromId -> conn.toId`.
- Dragging a node to the left-side dependency handle still creates a dependency.
- Dragging a node to the bottom child handle still creates or moves the node as a child ticket.
- Deleting a dependency connector still works.
- Critical-path highlighting still works for dependency connectors.

### 9.3 Regression Acceptance Criteria

- Existing maps loaded from local storage continue to render.
- Existing dependency connections without `type` still render as dependency arrows.
- No TypeScript errors are introduced.
- `npm run build` succeeds.

## 10. Test Cases

### Test Case 1: Basic Dependency Arrow

1. Create two nodes.
2. Connect node A as a dependency of node B using the left-side dependency handle.
3. Verify the line starts from the right edge of A.
4. Verify the line ends at the left edge of B.
5. Verify the arrow head points to B.

### Test Case 2: Child Relationship Is Not A Dependency Arrow

1. Drag node A to the bottom child handle of node B.
2. Verify A becomes a child of B.
3. Verify the line is a normal hierarchy line, not a dashed dependency arrow.

### Test Case 3: Existing Connection Without Type

1. Load data where a connection has only `id`, `fromId`, and `toId`.
2. Verify it is rendered as a dependency arrow.

### Test Case 4: Delete Dependency Connector

1. Create a dependency connector.
2. Click the connector.
3. Verify the connector is deleted.
4. Verify the involved nodes remain.

### Test Case 5: Build Validation

Run:

```bash
cd frontend
npm run build
```

Expected result:

```text
Build succeeds with no TypeScript or bundling errors.
```

## 11. Recommended Implementation Order

1. Update dependency connector path calculation in `MindMapCanvas.tsx`.
2. Keep arrow marker and dashed style.
3. Verify visual rendering manually.
4. Verify old connection data still renders.
5. Run frontend build.
6. Adjust marker gap only if the arrow overlaps with the target node.

## 12. Implementation Note for Codex

Use the existing `connections.map(...)` block in `frontend/components/MindMapCanvas.tsx` as the primary modification point.

Do not redesign the entire layout unless necessary. The requested change is specifically about dependency line rendering.

The dependency meaning must remain:

```text
conn.fromId precedes conn.toId
```

Therefore, do not reverse `fromId` and `toId` only to make the arrow look correct. Fix the rendering anchor points instead.
