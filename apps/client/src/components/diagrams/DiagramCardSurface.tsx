import { clsx } from 'clsx';
import React from 'react';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export interface DiagramCardSurfaceProps extends DivProps {
  interactive?: boolean;
}

const BASE_CLASSES =
  'relative overflow-hidden rounded-lg border p-3 transition-all duration-150 ease-out';
const INTERACTIVE_CLASSES =
  'cursor-pointer hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-0';

export const DiagramCardSurface = React.forwardRef<HTMLDivElement, DiagramCardSurfaceProps>(
  ({ className, interactive = false, children, tabIndex, ...rest }, ref) => {
    const resolvedTabIndex = tabIndex ?? (interactive ? 0 : undefined);

    return (
      <div
        ref={ref}
        className={clsx(BASE_CLASSES, interactive && INTERACTIVE_CLASSES, className)}
        tabIndex={resolvedTabIndex}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

DiagramCardSurface.displayName = 'DiagramCardSurface';

export default DiagramCardSurface;
