import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose-dark leading-relaxed text-[#CBD5E1] text-xs sm:text-sm ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 mb-2 text-lg sm:text-xl font-serif font-bold text-[#E2E8F0] tracking-tight border-b border-[#2D3748]/60 pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3.5 mb-1.5 text-base sm:text-lg font-serif font-semibold text-[#E2E8F0] tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1 text-sm sm:text-base font-serif font-semibold text-[#B5A48B]">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-2.5 mb-1 text-xs sm:text-sm font-semibold text-[#E2E8F0]">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0 leading-relaxed font-light text-[#CBD5E1]">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[#E2E8F0]">
              {children}
            </em>
          ),
          ul: ({ children }) => (
            <ul className="my-2 ml-4 list-disc space-y-1 text-[#CBD5E1]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-4 list-decimal space-y-1 text-[#CBD5E1]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1 text-[#CBD5E1]">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-[#B5A48B] bg-[#1A1E26]/60 py-2 pl-3.5 pr-3 text-xs sm:text-sm italic font-serif text-[#CBD5E1] rounded-r-md">
              {children}
            </blockquote>
          ),
          code: ({ children, className: codeClassName }) => {
            const isInline = !codeClassName || !codeClassName.includes('language-');
            if (isInline) {
              return (
                <code className="rounded bg-[#0A0C10] px-1.5 py-0.5 font-mono text-[11px] text-[#B5A48B] border border-[#2D3748]">
                  {children}
                </code>
              );
            }
            return (
              <code className="font-mono text-[11px] text-[#E2E8F0]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-lg bg-[#0A0C10] p-3.5 font-mono text-[11px] text-[#CBD5E1] border border-[#2D3748]">
              {children}
            </pre>
          ),
          hr: () => (
            <hr className="my-3 border-[#2D3748]" />
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-[#2D3748] text-left text-xs text-[#CBD5E1]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-[#1A1E26] px-3 py-1.5 font-semibold text-[#E2E8F0]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[#1F2937] px-3 py-1.5">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
