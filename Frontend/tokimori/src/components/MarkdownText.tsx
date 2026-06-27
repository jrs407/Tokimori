import { memo } from 'react';

/* ─── Inline formatting ─────────────────────────────────────── */
function parseInline(text: string, keyBase: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  // Order matters: ** before *, so bold is matched before italic
  const re = /(\*\*(.+?)\*\*|\*([^*\n]+?)\*|~~(.+?)~~|`([^`\n]+?)`)/g;
  let last = 0, k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined)
      nodes.push(<strong key={`${keyBase}-b${k++}`}>{m[2]}</strong>);
    else if (m[3] !== undefined)
      nodes.push(<em key={`${keyBase}-i${k++}`}>{m[3]}</em>);
    else if (m[4] !== undefined)
      nodes.push(<s key={`${keyBase}-s${k++}`}>{m[4]}</s>);
    else if (m[5] !== undefined)
      nodes.push(
        <code key={`${keyBase}-c${k++}`} style={{
          background: 'rgba(255,255,255,0.1)', padding: '1px 5px',
          borderRadius: 3, fontSize: '0.88em', fontFamily: 'monospace', color: '#a8d8ff',
        }}>{m[5]}</code>
      );
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  if (nodes.length === 0) return '';
  if (nodes.length === 1) return nodes[0];
  return nodes;
}

/* ─── Block renderer ─────────────────────────────────────────── */
export const MarkdownText = memo(({ text, className }: { text: string; className?: string }) => {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let ulItems: React.ReactNode[] = [];
  let olItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushUl = (i: number) => {
    if (!ulItems.length) return;
    blocks.push(
      <ul key={`ul-${i}`} style={{ margin: '3px 0', paddingLeft: '18px', color: 'inherit' }}>
        {ulItems}
      </ul>
    );
    ulItems = [];
  };
  const flushOl = (i: number) => {
    if (!olItems.length) return;
    blocks.push(
      <ol key={`ol-${i}`} style={{ margin: '3px 0', paddingLeft: '18px', color: 'inherit' }}>
        {olItems}
      </ol>
    );
    olItems = [];
  };
  const flush = (i: number) => { flushUl(i); flushOl(i); };

  lines.forEach((line, i) => {
    const k = `l${i}`;
    if (/^### /.test(line)) {
      flush(i);
      blocks.push(
        <h3 key={k} style={{ fontSize: '1em', fontWeight: 700, margin: '6px 0 2px', color: '#ccc' }}>
          {parseInline(line.slice(4), k)}
        </h3>
      );
    } else if (/^## /.test(line)) {
      flush(i);
      blocks.push(
        <h2 key={k} style={{ fontSize: '1.1em', fontWeight: 700, margin: '7px 0 2px', color: '#ddd' }}>
          {parseInline(line.slice(3), k)}
        </h2>
      );
    } else if (/^# /.test(line)) {
      flush(i);
      blocks.push(
        <h1 key={k} style={{ fontSize: '1.25em', fontWeight: 700, margin: '8px 0 3px', color: '#fff' }}>
          {parseInline(line.slice(2), k)}
        </h1>
      );
    } else if (/^[*-] /.test(line)) {
      flushOl(i);
      ulItems.push(
        <li key={`li-${listKey++}`} style={{ lineHeight: 1.6 }}>
          {parseInline(line.slice(2), k)}
        </li>
      );
    } else if (/^\d+\. /.test(line)) {
      flushUl(i);
      olItems.push(
        <li key={`oli-${listKey++}`} style={{ lineHeight: 1.6 }}>
          {parseInline(line.replace(/^\d+\. /, ''), k)}
        </li>
      );
    } else if (/^> /.test(line)) {
      flush(i);
      blocks.push(
        <blockquote key={k} style={{
          borderLeft: '3px solid rgba(102,126,234,0.7)', paddingLeft: '10px',
          margin: '4px 0', color: '#a0a0c0', fontStyle: 'italic',
        }}>
          {parseInline(line.slice(2), k)}
        </blockquote>
      );
    } else if (/^---+$/.test(line.trim())) {
      flush(i);
      blocks.push(
        <hr key={k} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.12)', margin: '8px 0' }} />
      );
    } else if (line.trim() === '') {
      flush(i);
      if (i < lines.length - 1)
        blocks.push(<div key={k} style={{ height: '5px' }} />);
    } else {
      flush(i);
      blocks.push(
        <p key={k} style={{ margin: '2px 0', lineHeight: 1.6 }}>
          {parseInline(line, k)}
        </p>
      );
    }
  });
  flush(lines.length);

  return (
    <div className={className} style={{ fontSize: '13px', color: '#c0c0d0', wordBreak: 'break-word' }}>
      {blocks}
    </div>
  );
});
MarkdownText.displayName = 'MarkdownText';
