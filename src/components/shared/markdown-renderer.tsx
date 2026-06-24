"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { CodeHighlight } from "@/components/shared/code-highlight";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  const components: Partial<Components> = {
    // Fenced code blocks — use existing CodeHighlight with highlight.js
    code: ({ className: cn, children, ...props }) => {
      const match = /language-(\w+)/.exec(cn || "");
      const isInline = !match;
      const code = String(children).replace(/\n$/, "");
      if (isInline) {
        return (
          <code
            className="rounded bg-white/10 px-1.5 py-0.5 text-sm font-mono text-amber-200"
            {...props}
          >
            {code}
          </code>
        );
      }
      return (
        <div className="my-2">
          <CodeHighlight code={code} language={match[1]} />
        </div>
      );
    },
    // Inline code is handled by the code component above (no language = inline)
    // Headings
    h1: ({ children }) => (
      <h1 className="mb-2 mt-4 text-lg font-bold text-foreground">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-2 mt-3 text-base font-bold text-foreground">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-1 mt-3 text-sm font-bold text-foreground">
        {children}
      </h3>
    ),
    // Paragraphs
    p: ({ children }) => (
      <p className="mb-2 text-sm leading-relaxed text-foreground/90 last:mb-0">
        {children}
      </p>
    ),
    // Lists
    ul: ({ children }) => (
      <ul className="mb-2 list-disc pl-5 text-sm text-foreground/90 space-y-1">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 list-decimal pl-5 text-sm text-foreground/90 space-y-1">
        {children}
      </ol>
    ),
    li: ({ children }) => <li>{children}</li>,
    // Bold / Strong
    strong: ({ children }) => (
      <strong className="font-bold text-foreground">{children}</strong>
    ),
    // Emphasis
    em: ({ children }) => (
      <em className="italic text-foreground/90">{children}</em>
    ),
    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 underline hover:text-blue-300 transition-colors"
      >
        {children}
      </a>
    ),
    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="mb-2 border-l-2 border-blue-500/40 pl-4 text-sm text-muted-foreground italic">
        {children}
      </blockquote>
    ),
    // Horizontal rule
    hr: () => <hr className="my-3 border-border" />,
  };

  return (
    <div className={`prose prose-sm max-w-none ${className || ""}`}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
