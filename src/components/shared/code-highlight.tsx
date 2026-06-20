"use client";

import { useEffect, useRef } from "react";
import hljs from "highlight.js";
// Import theme
import "highlight.js/styles/github-dark.css";

interface CodeHighlightProps {
  code: string;
  language: string;
  className?: string;
}

export function CodeHighlight({ code, language, className }: CodeHighlightProps) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      // Remove data-highlighted attribute to force re-highlighting on value changes
      codeRef.current.removeAttribute("data-highlighted");
      hljs.highlightElement(codeRef.current);
    }
  }, [code, language]);

  return (
    <pre className={`overflow-x-auto rounded-lg border border-white/5 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-foreground scrollbar-thin ${className || ""}`}>
      <code ref={codeRef} className={`language-${language} whitespace-pre`}>
        {code}
      </code>
    </pre>
  );
}
