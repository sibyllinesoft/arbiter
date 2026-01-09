/**
 * @packageDocumentation
 * Locator subcommand module - Handles adding UI test locators to CUE specifications.
 *
 * Defines selector mappings for end-to-end testing with tools like Playwright.
 */

/**
 * Adds a locator mapping to the specification
 */
export async function addLocator(
  manipulator: any,
  content: string,
  locatorKey: string,
  options: { selector?: string; [key: string]: any },
): Promise<string> {
  const { selector } = options;

  if (!selector) {
    throw new Error("Locator requires --selector");
  }

  return await manipulator.addToSection(content, "locators", locatorKey, selector);
}
