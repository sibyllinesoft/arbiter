/**
 * Plop Template System
 *
 * Exports the Plop implementor and Handlebars utilities.
 */

export { PlopImplementor, type PlopExecuteOptions } from "./implementor.js";
export {
  renderTemplate,
  compileTemplate,
  registerPartial,
  registerHelper,
  Handlebars,
} from "./handlebars-renderer.js";
