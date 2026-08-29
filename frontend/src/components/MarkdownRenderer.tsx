import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc ml-4 space-y-1 mb-2 text-sm">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ml-4 space-y-1 mb-2 text-sm">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        h1: ({ children }) => <h1 className="text-lg font-semibold mt-3 mb-2 text-gray-900">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2 text-gray-900">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-gray-900">{children}</h3>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ className, children }) => {
          const isInline = !className;
          return isInline ? (
            <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-brand-600">
              {children}
            </code>
          ) : (
            <code className="block p-3 bg-gray-50 rounded-lg text-xs font-mono overflow-x-auto my-2">
              {children}
            </code>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-brand-300 pl-4 italic text-gray-600 my-2 text-sm">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} className="text-brand-500 hover:text-brand-600 underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <table className="min-w-full divide-y divide-gray-200 my-2 text-sm">
            {children}
          </table>
        ),
        thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-gray-200 bg-white">{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 text-sm text-gray-700">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
