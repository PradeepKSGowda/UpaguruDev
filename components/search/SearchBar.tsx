"use client";

/**
 * @file components/search/SearchBar.tsx
 * @module SearchBar
 * @description Highly responsive, debounced search input client component.
 * Synchronizes keyword input to URL query parameters (?q=...) with 300ms debounce,
 * provides one-click clear button, loading indicator, and accessible keyboard shortcuts (⌘K / /).
 * 
 * Task ID: TASK-02040102 (Subtask: SUB-0204010201)
 * Architecture Reference: ADR-001 (Frontend RSC/Client Segregation), ADR-008 (SEO)
 * 
 * Complies with:
 * - Next.js 15 App Router navigation hooks (useRouter, useSearchParams, usePathname)
 * - 300ms debounce timeout to prevent server query flooding
 * - ARIA accessibility landmarks and keyboard shortcuts (Cmd+K, /, Escape)
 * - Zero CLS / layout shift design with clear button
 */

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

interface SearchBarProps {
  /** Placeholder text inside input */
  placeholder?: string;
  /** Custom additional styling classes */
  className?: string;
  /** Visual variant: 'default' for headers/feeds, 'large' for dedicated search hero */
  variant?: "default" | "large";
  /** Auto-focus the input on render */
  autoFocus?: boolean;
  /** Callback fired immediately when user triggers search */
  onSearchChange?: (query: string) => void;
}

export default function SearchBar({
  placeholder = "Search by exam title, authority (e.g. KPSC, UPSC, SSC), or role...",
  className = "",
  variant = "default",
  autoFocus = false,
  onSearchChange,
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Initialize query from URL search parameters (?q=...)
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize local input state if URL parameter changes externally
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Push debounced query to URL
  const updateUrlQuery = useCallback(
    (searchTerm: string) => {
      const trimmed = searchTerm.trim();
      const params = new URLSearchParams(searchParams.toString());

      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }

      // Reset page to 1 on new search keyword
      params.delete("page");

      startTransition(() => {
        // If already on /search, replace query parameters in-place
        if (pathname === "/search") {
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        } else {
          // If on home or another route, navigate to /search with the query
          router.push(`/search?${params.toString()}`);
        }
      });

      if (onSearchChange) {
        onSearchChange(trimmed);
      }
    },
    [pathname, router, searchParams, onSearchChange]
  );

  // 300ms debounce timer for keystroke input
  useEffect(() => {
    // Only debounce if the local query differs from current URL
    if (query === initialQuery) return;

    const timer = setTimeout(() => {
      updateUrlQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, initialQuery, updateUrlQuery]);

  // Global Keyboard shortcuts: Cmd+K / Ctrl+K / '/' to focus, Escape to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is already typing inside an input/textarea
      const isInputFocused =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === "/" && !isInputFocused) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        if (query.length > 0) {
          setQuery("");
          updateUrlQuery("");
        } else {
          inputRef.current?.blur();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [query, updateUrlQuery]);

  // Form submission: immediate trigger on Enter
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlQuery(query);
  };

  // Clear search input handler
  const handleClear = () => {
    setQuery("");
    updateUrlQuery("");
    inputRef.current?.focus();
  };

  const isLarge = variant === "large";

  return (
    <form
      role="search"
      aria-label="Site-wide exam notification search"
      onSubmit={handleSubmit}
      className={`relative w-full ${className}`}
    >
      <div
        className={`relative flex items-center w-full transition-all duration-200 rounded-xl border bg-surface dark:bg-surface-elevated/40 shadow-xs focus-within:shadow-md focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
          isLarge
            ? "h-14 sm:h-16 px-4 border-border/90 text-base"
            : "h-11 sm:h-12 px-3.5 border-border text-sm"
        }`}
      >
        {/* Search Icon / Pending Spinner */}
        <div className="flex items-center justify-center text-text-muted shrink-0 mr-3">
          {isPending ? (
            <Loader2
              id="search-bar-spinner"
              data-testid="search-bar-spinner"
              className={`animate-spin text-primary ${isLarge ? "h-5 w-5" : "h-4 w-4"}`}
            />
          ) : (
            <Search
              id="search-bar-icon"
              data-testid="search-bar-icon"
              className={isLarge ? "h-5 w-5" : "h-4 w-4"}
            />
          )}
        </div>

        {/* Search Input Field */}
        <input
          ref={inputRef}
          id="search-bar-input"
          data-testid="search-bar-input"
          type="search"
          name="q"
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              updateUrlQuery(query);
            }
          }}
          className="w-full bg-transparent text-text font-medium placeholder:text-text-muted/70 focus:outline-none"
          aria-label="Search notifications by title or conducting body"
        />
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1}>
          Search
        </button>

        {/* Clear Button & Keyboard Shortcut Badge */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {query.length > 0 && (
            <button
              id="search-clear-btn"
              data-testid="search-clear-btn"
              type="button"
              onClick={handleClear}
              aria-label="Clear search input"
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
            >
              <X className={isLarge ? "h-4 w-4" : "h-3.5 w-3.5"} />
            </button>
          )}

          {/* Desktop Keyboard Shortcut Badge (hidden when input has text or on mobile) */}
          {query.length === 0 && (
            <kbd
              aria-hidden="true"
              className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-mono font-semibold rounded-md border border-border bg-surface-elevated/70 text-text-muted select-none"
            >
              <span className="text-[10px]">⌘</span>K
            </kbd>
          )}
        </div>
      </div>
    </form>
  );
}
