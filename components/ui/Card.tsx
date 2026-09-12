import type { ReactNode } from "react";

type Props = {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function Card({ header, footer, children, className = "" }: Props) {
  return (
    <section className={`rounded-lg border border-black/10 bg-white ${className}`}>
      {header ? (
        <header className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3 text-sm font-semibold">
          {header}
        </header>
      ) : null}
      <div className="px-4 py-3 text-sm">{children}</div>
      {footer ? (
        <footer className="border-t border-black/10 px-4 py-3 text-sm">{footer}</footer>
      ) : null}
    </section>
  );
}
