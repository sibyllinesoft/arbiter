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
