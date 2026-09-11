# System Design: Interactive Filter Bar Client Component (`FilterBar.tsx`)

## 1. Overview & Context
- **Task ID**: `TASK-02020103` (Subtasks: `SUB-0202010301`, `SUB-0202010302`)
- **Epic**: `EPIC-02` (Candidate Portal: Notification Feed, Detail Pages & Search)
- **Feature**: `FEAT-0202` (Homepage Notification Feed with Filters & Pagination)
- **User Story**: `STORY-020201` (Candidate browsing exam notifications with filters)
- **Target Files**:
  - `components/notifications/FilterBar.tsx` (Interactive Filter Bar)
  - `components/notifications/index.ts` (Barrel Export)
  - `lib/constants.ts` (Category options, States, Sort options)

---

## 2. Component Architecture & URL Synchronization

```mermaid
flowchart LR
    subgraph ClientComponent [FilterBar.tsx ('use client')]
        Pills["Category Pills (All, Civil Services, Banking, ...)"]
        StateSelect["State / Region Dropdown"]
        SearchInput["Keyword Search Box"]
        SortSelect["Sort Criteria Dropdown"]
        ClearBtn["Reset Filters Button"]
    end

    subgraph NavigationLayer [Next.js App Router Navigation]
        HookRouter["useRouter().push(targetUrl, { scroll: false })"]
        HookParams["useSearchParams() & usePathname()"]
        Transition["useTransition() [isPending]"]
    end

    subgraph ServerComponent [app/(portal)/page.tsx (RSC)]
        PageRSC["Page (Server Component)"]
        DataAccess["getPublishedNotifications(validatedParams)"]
        PostgREST["Supabase PostgREST Query"]
    end

    Pills -->|onClick| HookRouter
    StateSelect -->|onChange| HookRouter
    SearchInput -->|onSubmit| HookRouter
    SortSelect -->|onChange| HookRouter
    ClearBtn -->|onClick| HookRouter
    HookRouter --> Transition
    Transition -->|Non-blocking URL Mutation| HookParams
    HookParams -->|Triggers RSC Re-render| PageRSC
    PageRSC --> DataAccess
    DataAccess --> PostgREST
```

---

## 3. Filter Mutator & URL State Management
1. **Shallow URL Updates**: Updates are dispatched via `router.push(targetUrl, { scroll: false })` wrapped in React 18/19 `startTransition`, avoiding full-page reloads and keeping scroll position steady.
2. **Automatic Pagination Reset**: Any filter mutation automatically removes the `?page=` parameter, resetting the candidate view to Page 1 of the filtered results.
3. **Clean URL Representation**: Default values (`category=all`, `state=all`, `sortBy=deadline_soonest`, empty search) are omitted from the URL query string to ensure clean, canonical, SEO-friendly URLs.
4. **State Dropdown Coverage**: 30 Indian states and central territories mapped for candidate regional exam targeting.
5. **Automated Testing Landmarks**:
   - `id="notification-filter-bar"`
   - `id="filter-search-input"`, `id="filter-search-submit-btn"`
   - `id="state-filter-select"`, `id="sort-by-select"`
   - `id="clear-all-filters-btn"`
   - `id={cat.id}` (e.g. `filter-cat-civil`, `filter-cat-banking`) with `data-testid` and `aria-selected`.
