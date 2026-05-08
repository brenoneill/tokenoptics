"use client";

import ReactMarkdown, { type Components } from "react-markdown";

const components: Components = {
  h1: (props) => (
    <h1 className="mb-2 mt-3 text-base font-semibold text-fg" {...props} />
  ),
  h2: (props) => (
    <h2 className="mb-2 mt-3 text-sm font-semibold text-fg" {...props} />
  ),
  h3: (props) => (
    <h3 className="mb-1.5 mt-2 text-sm font-semibold text-fg" {...props} />
  ),
  h4: (props) => (
    <h4 className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wider text-fg-muted" {...props} />
  ),
  p: (props) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
  ul: (props) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0" {...props} />
  ),
  ol: (props) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0" {...props} />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-fg" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  a: (props) => (
    <a
      className="text-accent underline-offset-2 hover:underline"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  code: ({ className, children, ...rest }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code
          className={`block overflow-x-auto rounded-md border border-border-muted bg-bg-emphasis px-3 py-2 font-mono text-xs ${className ?? ""}`}
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-bg-emphasis px-1 py-0.5 font-mono text-[0.85em] text-fg"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre className="mb-2 last:mb-0" {...props} />
  ),
  blockquote: (props) => (
    <blockquote
      className="mb-2 border-l-2 border-border pl-3 text-fg-muted last:mb-0"
      {...props}
    />
  ),
  hr: () => <hr className="my-3 border-border-muted" />,
};

interface Props {
  text: string;
  className?: string;
}

export function Markdown({ text, className }: Props) {
  return (
    <div className={`text-sm leading-relaxed text-fg ${className ?? ""}`}>
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
}
