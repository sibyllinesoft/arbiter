declare module "inquirer" {
  export type QuestionCollection<T = any> =
    | ReadonlyArray<Record<string, unknown>>
    | Record<string, unknown>;

  export interface Inquirer {
    prompt<T = Record<string, unknown>>(
      questions: QuestionCollection<T>,
      answers?: Partial<T>,
    ): Promise<T>;
  }

  const inquirer: Inquirer;
  export default inquirer;
}

declare module "ora" {
  export interface Spinner {
    interval?: number;
    frames: string[];
  }

  export interface Options {
    text?: string;
    color?: string;
    spinner?: Spinner | string;
  }

  export interface Ora {
    text: string;
    color?: string;
    start(text?: string): Ora;
    stop(): Ora;
    succeed(text?: string): Ora;
    fail(text?: string): Ora;
    info(text?: string): Ora;
    warn(text?: string): Ora;
  }

  function ora(options?: Options | string): Ora;
  export default ora;
}

declare module "cli-spinners" {
  export interface SpinnerDefinition {
    interval: number;
    frames: string[];
  }

  export type SpinnerName = string;

  const spinners: Record<SpinnerName, SpinnerDefinition>;
  export default spinners;
}

declare module "cli-table3" {
  export interface TableOptions {
    head?: Array<string>;
    style?: Record<string, unknown>;
    colWidths?: number[];
  }

  export type TableRow = Array<string | number>;

  export default class Table {
    constructor(options?: TableOptions);
    push(...rows: TableRow[]): number;
    toString(): string;
  }
}
