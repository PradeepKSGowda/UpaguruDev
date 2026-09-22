/**
 * @file types/playwright.d.ts
 * @description Ambient TypeScript type declarations for @playwright/test.
 * Ensures strict typing and seamless IDE language server resolution for Playwright E2E
 * test suites across desktop and mobile runners.
 */

declare module "@playwright/test" {
  export interface ViewportSize {
    width: number;
    height: number;
  }

  export interface Locator {
    first(): Locator;
    last(): Locator;
    nth(index: number): Locator;
    locator(selector: string): Locator;
    getByTestId(testId: string): Locator;
    or(locator: Locator): Locator;
    click(options?: { timeout?: number; force?: boolean }): Promise<void>;
    fill(value: string, options?: { timeout?: number }): Promise<void>;
    press(key: string, options?: { timeout?: number }): Promise<void>;
    isVisible(options?: { timeout?: number }): Promise<boolean>;
    isEnabled(options?: { timeout?: number }): Promise<boolean>;
    isDisabled(options?: { timeout?: number }): Promise<boolean>;
    inputValue(options?: { timeout?: number }): Promise<string>;
    textContent(options?: { timeout?: number }): Promise<string | null>;
    count(): Promise<number>;
  }

  export interface Page {
    goto(url: string, options?: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit" }): Promise<unknown>;
    waitForURL(url: string | RegExp, options?: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit" }): Promise<unknown>;
    waitForLoadState(state?: "load" | "domcontentloaded" | "networkidle", options?: { timeout?: number }): Promise<void>;
    url(): string;
    locator(selector: string): Locator;
    getByTestId(testId: string): Locator;
    setViewportSize(viewportSize: ViewportSize): Promise<void>;
    evaluate<R, Arg = unknown>(pageFunction: (arg: Arg) => R | Promise<R>, arg?: Arg): Promise<R>;
    evaluate<R>(pageFunction: () => R | Promise<R>): Promise<R>;
  }

  export interface PlaywrightTestArgs {
    page: Page;
  }

  export interface ExpectMatcher {
    toBeVisible(options?: { timeout?: number }): Promise<void>;
    toBeEnabled(options?: { timeout?: number }): Promise<void>;
    toBeDisabled(options?: { timeout?: number }): Promise<void>;
    toHaveURL(url: string | RegExp, options?: { timeout?: number }): Promise<void>;
    toHaveTitle(title: string | RegExp, options?: { timeout?: number }): Promise<void>;
    toHaveAttribute(name: string, value: string | RegExp, options?: { timeout?: number }): Promise<void>;
    toHaveValue(value: string | RegExp, options?: { timeout?: number }): Promise<void>;
    toContainText(text: string | RegExp, options?: { timeout?: number }): Promise<void>;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBe(expected: unknown): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toContain(expected: string): void;
    not: ExpectMatcher;
  }

  export interface TestType {
    (title: string, testFunction: (fixtures: PlaywrightTestArgs) => Promise<void> | void): void;
    describe(title: string, fn: () => void): void;
    beforeEach(fn: (fixtures: PlaywrightTestArgs) => Promise<void> | void): void;
    afterEach(fn: (fixtures: PlaywrightTestArgs) => Promise<void> | void): void;
    beforeAll(fn: () => Promise<void> | void): void;
    afterAll(fn: () => Promise<void> | void): void;
    skip(condition: boolean, reason?: string): void;
    only(title: string, testFunction: (fixtures: PlaywrightTestArgs) => Promise<void> | void): void;
  }

  export interface Project {
    name: string;
    use?: Record<string, unknown>;
    testMatch?: string | RegExp | Array<string | RegExp>;
    testIgnore?: string | RegExp | Array<string | RegExp>;
  }

  export interface PlaywrightTestConfig {
    testDir?: string;
    timeout?: number;
    expect?: {
      timeout?: number;
    };
    fullyParallel?: boolean;
    forbidOnly?: boolean;
    retries?: number;
    workers?: number | string | undefined;
    reporter?: unknown;
    use?: Record<string, unknown>;
    projects?: Project[];
    webServer?: {
      command: string;
      url: string;
      reuseExistingServer?: boolean;
      timeout?: number;
      stdout?: string;
      stderr?: string;
    };
    [key: string]: unknown;
  }

  export interface AsyncExpectMatcher {
    toPass(options?: { timeout?: number; intervals?: number[] }): Promise<void>;
  }

  export const test: TestType;
  export function expect(actual: () => Promise<void> | void): AsyncExpectMatcher;
  export function expect(actual: unknown): ExpectMatcher;
  export function defineConfig(config: PlaywrightTestConfig): PlaywrightTestConfig;
  export const devices: Record<string, Record<string, unknown>>;
}
