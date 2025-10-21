export const editor = {
  create: () => ({
    dispose: () => {},
    onDidBlurEditorText: () => ({ dispose: () => {} }),
    onDidFocusEditorText: () => ({ dispose: () => {} }),
    getModel: () => ({
      updateOptions: () => {},
      dispose: () => {},
    }),
    updateOptions: () => {},
    layout: () => {},
  }),
};

export const languages = {
  register: () => ({ dispose: () => {} }),
  setMonarchTokensProvider: () => ({ dispose: () => {} }),
  registerCompletionItemProvider: () => ({ dispose: () => {} }),
  registerHoverProvider: () => ({ dispose: () => {} }),
};

export const Uri = {
  parse: (value: string) => ({ toString: () => value }),
};

export default {
  editor,
  languages,
  Uri,
};
