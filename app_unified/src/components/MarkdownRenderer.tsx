import React from 'react';

export const MarkdownRenderer = ({ content, isStreaming = false }: { content: string, isStreaming?: boolean }) => {
    const processInline = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|\$.*?\$|`.*?`)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-txt-main font-black">{part.slice(2, -2)}</strong>;
            if (part.startsWith('$') && part.endsWith('$')) return <span key={i} className="text-secondary font-mono bg-secondary/10 px-1 rounded mx-1">{part.slice(1, -1)}</span>;
            if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="text-primary font-mono bg-surface-light px-1 rounded">{part.slice(1, -1)}</code>;
            return <span key={i}>{part}</span>;
        });
    };

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];
    let inTable = false;

    const flushTable = (keyPrefix: string) => {
        if (tableBuffer.length === 0) return null;
        const rows = tableBuffer.map(row => row.split('|').filter(c => c.trim() !== '').map(c => c.trim()));
        const header = rows[0] || [];
        const body = rows.slice(1).filter(r => r.length > 0 && !r.every(c => c.includes('---')));

        const table = (
            <div key={keyPrefix} className="my-6 overflow-x-auto custom-scrollbar rounded-2xl border border-surface-light shadow-md">
                <table className="w-full text-sm text-left">
                    <thead className="bg-surface-light text-txt-main uppercase font-black tracking-widest">
                        <tr>{header.map((h, i) => <th key={i} className="px-5 py-4">{processInline(h)}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-surface-light bg-surface">
                        {body.map((row, i) => (
                            <tr key={i} className="hover:bg-surface-light/50 transition-colors">
                                {row.map((cell, j) => (
                                    <td key={j} className={`px-5 py-3 font-medium ${j === 0 ? 'text-primary font-black' : 'text-txt-main'}`}>
                                        {processInline(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
        tableBuffer = [];
        inTable = false;
        return table;
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('|')) {
            inTable = true;
            tableBuffer.push(trimmed);
            if (index === lines.length - 1) {
                const tbl = flushTable(`tbl-${index}`);
                if (tbl) elements.push(tbl);
            }
            return;
        } else if (inTable) {
            const tbl = flushTable(`tbl-${index}`);
            if (tbl) elements.push(tbl);
        }

        if (trimmed.startsWith('###')) {
            elements.push(<h4 key={index} className="text-base font-black text-primary uppercase tracking-widest mt-8 mb-3 border-b-2 border-surface-light pb-2">{trimmed.replace(/^###\s*/, '')}</h4>);
        } else if (trimmed.startsWith('##')) {
            elements.push(<h3 key={index} className="text-lg font-black text-txt-main mt-10 mb-4 flex items-center gap-3"><div className="w-1.5 h-6 bg-primary rounded-full"></div>{trimmed.replace(/^##\s*/, '')}</h3>);
        } else if (trimmed.startsWith('#')) {
            elements.push(<h2 key={index} className="text-2xl font-black text-txt-main mt-6 mb-6 tracking-tighter">{trimmed.replace(/^#\s*/, '')}</h2>);
        }
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            elements.push(<div key={index} className="flex gap-3 ml-2 mb-1 text-txt-main"><span className="text-primary font-bold mt-1.5">•</span><span className="leading-relaxed">{processInline(trimmed.substring(2))}</span></div>);
        }
        else if (/^\d+\./.test(trimmed)) {
            elements.push(<div key={index} className="flex gap-3 ml-2 mb-1 text-txt-main"><span className="text-secondary font-bold mt-0.5 min-w-[20px]">{trimmed.split('.')[0]}.</span><span className="leading-relaxed">{processInline(trimmed.replace(/^\d+\.\s*/, ''))}</span></div>);
        }
        else if (trimmed === '') {
            elements.push(<div key={index} className="h-2"></div>);
        }
        else {
            elements.push(<p key={index} className="text-txt-main leading-relaxed mb-2 text-sm font-medium">{processInline(trimmed)}</p>);
        }
    });

    if (inTable) {
        const tbl = flushTable(`tbl-end`);
        if (tbl) elements.push(tbl);
    }
    if (isStreaming) {
        elements.push(
            <span key="cursor" className="inline-block w-1.5 h-3.5 bg-primary/80 animate-pulse ml-1 align-middle"></span>
        );
    }
    return <div className="space-y-1">{elements}</div>;
};
