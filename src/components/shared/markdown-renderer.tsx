"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm"; // 1. Import the plugin
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

    // 2. Table Component Mappings
    table: ({ children }) => (
      <div className="my-4 w-full overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm text-foreground/90 border-collapse">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-white/5 text-foreground font-semibold border-b border-border">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-border/40">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 font-bold text-foreground">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-sm text-foreground/80">{children}</td>
    ),
  };

  return (
    <div className={`prose prose-sm max-w-none ${className || ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]} // 3. Pass the plugin here
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
