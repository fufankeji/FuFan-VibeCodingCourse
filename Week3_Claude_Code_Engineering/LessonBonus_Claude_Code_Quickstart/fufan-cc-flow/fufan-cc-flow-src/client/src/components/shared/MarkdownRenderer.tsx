import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";

interface Props {
  content: string;
}

function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="group relative my-3">
      <div className="flex items-center justify-between rounded-t-lg bg-obsidian-700/80 px-4 py-1.5 border border-b-0 border-obsidian-600/50">
        <span className="text-[11px] font-mono text-obsidian-300 uppercase tracking-wider">
          {language || "text"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-obsidian-300 hover:text-obsidian-50 transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: "0 0 8px 8px",
          border: "1px solid color-mix(in srgb, #222833 90%, transparent)",
          borderTop: "none",
          background: "#06080b",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
        showLineNumbers
        lineNumberStyle={{
          color: "#3d4556",
          fontSize: "11px",
          paddingRight: "16px",
          minWidth: "2.5em",
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MarkdownRenderer({ content }: Props) {
  return (
    <div className="prose-obsidian text-[14px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");
            const text = String(children).replace(/\n$/, "");
            if (match) {
              return <CodeBlock language={match[1]}>{text}</CodeBlock>;
            }
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
