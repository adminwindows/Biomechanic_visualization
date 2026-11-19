import { useId, type ReactNode, type SVGProps } from 'react';

export type IconName = 'study' | 'compare' | 'movement' | 'machine' | 'search' | 'measure' | 'library' | 'settings' | 'help' | 'download' | 'upload' | 'command' | 'close' | 'chevron' | 'check' | 'warning' | 'arrow' | 'play' | 'undo' | 'redo';
export type IconProps = Omit<SVGProps<SVGSVGElement>, 'name' | 'children'> & { name: IconName; size?: number; title?: string };

const shapes: Record<IconName, ReactNode> = {
  study: <><path d="M8 3h8l4 4v14H4V3h4Zm8 0v5h4M8 17v-3m4 3v-7m4 7v-5" /></>,
  compare: <><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /><path d="M6.5 8v8m11-8v8" /></>,
  movement: <><circle cx="14" cy="4" r="2" /><circle cx="11" cy="12" r="1.5" /><path d="m12.5 7-3 3-5-1m7 1.5 4.5 1.5 4-4m-8 5.5L8 17l-5 3m9-6 4 4v3" /></>,
  machine: <><path d="M4 21V4h13v17M2 21h19M9 8h8m-8 5h8m-8 5h8M5 4h4v17M20 5v8l-3 3" /><circle cx="20" cy="3" r="1.5" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  measure: <><path d="m3 16 13-13 5 5L8 21 3 16Zm4-4 2 2m2-6 2 2m2-6 2 2" /></>,
  library: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="4" height="16" rx="1" /><path d="m16 5 3-1 3 15-3 1-3-15ZM3 8h5m2 0h4" /></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="var(--icon-surface, currentColor)" /><circle cx="16" cy="12" r="2" fill="var(--icon-surface, currentColor)" /><circle cx="10" cy="18" r="2" fill="var(--icon-surface, currentColor)" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01" /></>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" /></>,
  upload: <><path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5" /></>,
  command: <><path d="M8 8V5a3 3 0 1 0-3 3h11V5a3 3 0 1 1 3 3H8v11a3 3 0 1 1-3-3h14a3 3 0 1 1-3 3V8" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  check: <path d="m4 12 5 5L20 6" />,
  warning: <><path d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  play: <path d="m8 4 12 8-12 8V4Z" />,
  undo: <path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12" transform="translate(0 -2)" />,
  redo: <path d="m15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12" transform="translate(0 -2)" />,
};

/** Decorative by default. Give title or aria-label when the image itself conveys meaning. */
export function Icon({ name, size = 20, title, className, ...props }: IconProps) {
  const titleId = useId();
  const labeled = Boolean(title || props['aria-label'] || props['aria-labelledby']);
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" focusable="false" className={['icon', className].filter(Boolean).join(' ')} role={labeled ? 'img' : undefined} aria-hidden={labeled ? undefined : true} aria-labelledby={title ? titleId : undefined} {...props}>
    {title && <title id={titleId}>{title}</title>}
    {shapes[name]}
  </svg>;
}

export default Icon;
