This codebase is a sophisticated React application for a "Spec Driven Development" system. It relies heavily on **React Flow**, **Monaco Editor**, and **React Query**.

Overall, the code quality is high—it uses modern hooks, strong typing, and a consistent design system. However, due to the scale of features (visualizing CUE specs, managing projects, handling websockets, rendering complex diagrams), it suffers from **colocation bloat** and **duplicated normalization logic**.

Here are specific opportunities to simplify, clarify, and organize the codebase.

---

### 1. Structural Reorganization: Feature-Based Architecture
Currently, the structure is split by technical type (`components`, `hooks`, `pages`). As the app grows, this makes it hard to find related logic. I recommend moving to a **Feature-based** folder structure.

**Current:**
```text
src/
  components/
    ServicesReport/
    ClientsReport/
    diagrams/
    ...
  hooks/
  types/
```

**Proposed:**
```text
src/
  features/
    spec-visualization/    (Diagrams, Mermaid, ReactFlow wrappers)
    project-management/    (Project lists, creation, import)
    editor/                (Monaco, FileTree, File tabs)
    catalog/               (ServicesReport, ClientsReport - unified)
    activity/              (EventsReport, ActionLog)
  shared/                  (Design System, generic hooks, utils)
```

### 2. Consolidate "Report" Components
**The Problem:** `ServicesReport`, `ClientsReport`, `InfrastructureReport`, and `PackagesReport` contain 80% identical boilerplate code. They all:
1. Fetch resolved specs.
2. Normalize data (extract metadata, handle arrays).
3. Manage "Add/Edit" modal states.
4. Render an `EntityCatalog` (grid of cards).

**The Solution:** Create a generic `GenericCatalog` or `EntityExplorer` component.

**Refactoring Example:**
Instead of separate components, create a configuration-driven page:

```tsx
// features/catalog/GenericCatalog.tsx
interface CatalogConfig<T> {
  entityType: string; // 'service' | 'client' | 'infrastructure'
  fetcher: (projectId: string) => Promise<T[]>;
  normalizer: (raw: any) => NormalizedItem;
  cardComponent: React.FC<{ item: NormalizedItem }>;
  modalComponent: React.FC<{ mode: 'create'|'edit' }>;
}

export const GenericCatalog = ({ config, projectId }) => {
  // ... Unified React Query logic and Modal state management here ...
  // This deletes ~500 lines of duplicated state logic across the 5 reports
}
```

### 3. Extract "Normalizers" into a Transformation Layer
**The Problem:** Files like `components/ServicesReport/normalizers.ts` and `components/ClientsReport/normalizers.ts` perform heavy data massaging inside the component render cycle (via `useMemo`). They also duplicate logic for extracting "metadata", "display names", and "source paths".

**The Solution:** Create a dedicated **Transformation Layer**.
1. Create a class or utility set that takes raw CUE JSON output and standardizes it into a strict frontend interface *before* it reaches the React components.
2. Move `shouldTreatAsInternalService`, `isLikelyCodePath`, etc., into a shared `spec-utils` library.

### 4. Refactor the Monolithic API Service
**The Problem:** `src/services/api.ts` is over 500 lines long and mixes concerns (Auth, GitHub, Project CRUD, Tunnels, Validation).

**The Solution:** Split into domain-specific services.
```typescript
// services/index.ts
export const api = {
  auth: new AuthService(),
  projects: new ProjectService(),
  github: new GitHubService(),
  spec: new SpecService(), // validation, freezing, resolution
  system: new SystemService() // tunnels, environment
};
```

### 5. Simplify `EventsReport` (The "God Switch")
**The Problem:** `components/EventsReport/utils/eventSummary.ts` contains a massive switch statement handling text formatting for every possible event type. This breaks the Open-Closed principle.

**The Solution:** Use a **Strategy Pattern** or a config object.

```typescript
// Refactored approach
const EVENT_FORMATTERS: Record<EventType, (event: Event) => string> = {
  fragment_created: (e) => `Added fragment ${e.data.path}...`,
  validation_failed: (e) => `Validation failed: ${e.data.error_count} errors...`,
  // ...
};

export const formatEventSummary = (event: Event) => {
  const formatter = EVENT_FORMATTERS[event.event_type];
  return formatter ? formatter(event) : summarizeGeneric(event.data);
};
```

### 6. Unify Diagram Layout Engines
**The Problem:** `ArchitectureDiagram`, `ArchitectureFlowDiagram`, and `TasksDiagram` utilize different ways to calculate layouts (Dagre vs React Flow's internal mechanics vs custom positioning).

**The Solution:** Centralize the `DiagramLayoutEngine` (`src/utils/diagramLayout.ts`).
Currently, this file exists but isn't used uniformly. Make all diagram components accept `nodes` and `edges`, and have a single hook `useAutoLayout(nodes, edges, algorithm)` that returns positioned nodes.

### 7. Fix `ArchitectureDiagram/index.tsx` Complexity
**The Problem:** This file is 22KB+ and handles:
1. Data fetching.
2. Recursive tree building.
3. Complex grouping logic (Services vs Routes vs Infrastructure).
4. Modal state management.

**The Solution:**
1. **Extract Data Logic:** Move `computeGroupedComponents` to a pure utility file `src/utils/spec-grouping.ts`.
2. **Extract Modal Logic:** Create a `useArchitectureModals` hook.
3. **Atomic Components:** `SourceGroup`, `RouteCardsSection`, etc., are good, but `index.tsx` should act as a clean orchestrator, not a logic dump.

### 8. Standardization of Types
**The Problem:** `types/api.ts` vs `types/ui.ts` vs component-level interfaces.
There is an interface `NormalizedService` in `ServicesReport/types.ts` and similar interfaces in other reports.

**The Solution:** Define a **Domain Model** for the frontend.
Create a `types/domain.ts` that defines what a `Service`, `Client`, `Resource`, and `Dependency` look like within the UI, regardless of which report is displaying them.

### 9. Design System Imports
**The Problem:** Imports are inconsistent.
Sometimes: `import Button from "@/design-system/components/Button"`
Sometimes: `import { Button } from "@/design-system"`

**The Solution:** Enforce strict barrel imports from `@/design-system`.
Update `tsconfig.json` or ESLint to prevent deep imports into the design system folders. This makes refactoring the design system easier in the future.

### 10. Delete Dead/Test Code
There are files like `MonacoTest.tsx` and `MonacoTestApp.tsx` included in the source bundle. These should be moved to a `_playground` folder or deleted from the production source tree to reduce noise.

### Summary of Action Plan

1.  **Split `api.ts`** into domain services.
2.  **Move `ServicesReport/normalizers.ts`** and similar logic to a shared `features/spec/transformers` directory.
3.  **Refactor `EventsReport`** to use a config map instead of a switch statement.
4.  **Create `useCatalog` hook** to abstract the fetching/filtering/modal logic shared by all Report pages.
5.  **Standardize Diagramming**: Ensure `TasksDiagram` and `ArchitectureDiagram` share the same layout engine utility.
