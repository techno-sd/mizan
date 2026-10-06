// Small inline icon set (stroke icons, inherit currentColor).
type P = { className?: string };
const base = "shrink-0";
const svg = (className: string | undefined, children: React.ReactNode, viewBox = "0 0 24 24") => (
  <svg
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`${base} ${className ?? "h-5 w-5"}`}
  >
    {children}
  </svg>
);

export const ScaleLogo = ({ className }: P) =>
  svg(
    className,
    <>
      <path d="M12 3v17" />
      <path d="M7 20h10" />
      <path d="M5 7h14" />
      <path d="M12 5.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z" />
      <path d="M5 7l-3 6a3 3 0 0 0 6 0z" />
      <path d="M19 7l-3 6a3 3 0 0 0 6 0z" />
    </>,
  );
export const Check = ({ className }: P) => svg(className, <path d="M5 12.5l4.2 4.2L19 7" />);
export const Alert = ({ className }: P) =>
  svg(className, <><path d="M12 8v5" /><path d="M12 16.5v.01" /><path d="M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>);
export const Search = ({ className }: P) => svg(className, <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const Diff = ({ className }: P) => svg(className, <><path d="M8 3v12" /><path d="M5 6h6" /><path d="M16 9v12" /><path d="M13 18h6" /></>);
export const Book = ({ className }: P) =>
  svg(className, <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></>);
export const Copy = ({ className }: P) =>
  svg(className, <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>);
export const External = ({ className }: P) => svg(className, <><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>);
export const Chevron = ({ className }: P) => svg(className, <path d="M6 9l6 6 6-6" />);
export const ImageIcon = ({ className }: P) => svg(className, <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-9 9" /></>);
export const Paste = ({ className }: P) =>
  svg(className, <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4.5V3h6v1.5" /><path d="M9 11h6M9 15h4" /></>);
export const Eraser = ({ className }: P) => svg(className, <><path d="M7 21h10" /><path d="M5.6 15.6l7.8-7.8 4.8 4.8-6.2 6.2H8.8z" /></>);
export const Shield = ({ className }: P) => svg(className, <><path d="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6z" /><path d="M9 12l2 2 4-4" /></>);
export const Ban = ({ className }: P) => svg(className, <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>);
export const Users = ({ className }: P) =>
  svg(className, <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>);
export const Repeat = ({ className }: P) => svg(className, <><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></>);
