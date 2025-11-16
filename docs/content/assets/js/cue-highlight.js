(function () {
  function registerCue() {
    if (window.hljs && window.hljsDefineCue && !window.hljs.listLanguages().includes("cue")) {
      window.hljs.registerLanguage("cue", window.hljsDefineCue);
    }
  }

  function highlightCueBlocks() {
    if (!window.hljs) return;
    document.querySelectorAll("pre code.language-cue").forEach((el) => {
      window.hljs.highlightElement(el);
    });
  }

  const init = () => {
    registerCue();
    highlightCueBlocks();
  };

  if (window.document$) {
    document$.subscribe(init);
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }
})();
