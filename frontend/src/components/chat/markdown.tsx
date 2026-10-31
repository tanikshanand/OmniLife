"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

export function Markdown({ content }: { content: string }) {
  return (
    <div className="max-w-none text-sm leading-relaxed text-neutral-800 dark:text-slate-200 [&_a]:text-neutral-900 dark:[&_a]:text-white [&_a]:underline [&_a]:font-medium [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 dark:[&_blockquote]:border-neutral-700 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600 dark:[&_blockquote]:text-neutral-400 [&_code]:rounded [&_code]:bg-neutral-100 dark:[&_code]:bg-neutral-800/80 [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2.5 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:text-neutral-900 dark:[&_strong]:text-slate-100 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
