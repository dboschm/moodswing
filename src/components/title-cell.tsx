import type { ReactNode } from 'react';

interface TitleCellProps {
  /** Optional caption above the value. */
  label?: string;
  /** Makes the label a <label> for this input id. */
  labelFor?: string;
  className?: string;
  children: ReactNode;
}

/** One box of the title block: a small caption above its value, like a drawing's title block. */
export function TitleCell({ label, labelFor, className, children }: TitleCellProps) {
  return (
    <div className={className ? `title-cell ${className}` : 'title-cell'}>
      {label &&
        (labelFor ? (
          <label className="title-cell__label" htmlFor={labelFor}>
            {label}
          </label>
        ) : (
          <span className="title-cell__label">{label}</span>
        ))}
      <div className="title-cell__value">{children}</div>
    </div>
  );
}
