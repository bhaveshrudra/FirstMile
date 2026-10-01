import React from 'react';

type GridColCount = 1 | 2 | 3 | 4 | 5 | 6 | 12;

interface MetricGridProps {
  /** Number of columns at various breakpoints */
  cols?: {
    default?: GridColCount;
    sm?: GridColCount;
    md?: GridColCount;
    lg?: GridColCount;
    xl?: GridColCount;
  };
  /** Gap size */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Grid children (KPI cards, etc.) */
  children: React.ReactNode;
}

const defaultColMap: Record<GridColCount, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
};

const smColMap: Record<GridColCount, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6',
  12: 'sm:grid-cols-12',
};

const mdColMap: Record<GridColCount, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
  12: 'md:grid-cols-12',
};

const lgColMap: Record<GridColCount, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
  12: 'lg:grid-cols-12',
};

const xlColMap: Record<GridColCount, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
  12: 'xl:grid-cols-12',
};

const gapClasses = {
  sm: 'gap-1.5',
  md: 'gap-3',
  lg: 'gap-4',
};

export const MetricGrid: React.FC<MetricGridProps> = ({
  cols = { default: 2, sm: 3, lg: 6 },
  gap = 'md',
  className = '',
  children,
}) => {
  const colClasses = [
    cols.default ? defaultColMap[cols.default] : 'grid-cols-2',
    cols.sm ? smColMap[cols.sm] : '',
    cols.md ? mdColMap[cols.md] : '',
    cols.lg ? lgColMap[cols.lg] : '',
    cols.xl ? xlColMap[cols.xl] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`grid ${colClasses} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
};

export default MetricGrid;
