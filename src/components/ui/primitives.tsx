'use client';

// Small shadcn-style primitives: input, textarea, native select, label, card, badge, alert, skeleton, separator, table.
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const fieldBase =
  'flex w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input type={type} ref={ref} className={cn(fieldBase, 'h-9 py-1 file:border-0 file:bg-transparent file:text-sm file:font-medium', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-[72px] py-2', className)} {...props} />
));
Textarea.displayName = 'Textarea';

/** A styled native select: reliable with react-hook-form and on tablets. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, 'h-9 py-1 pr-8', className)} {...props}>
    {children}
  </select>
));
NativeSelect.displayName = 'NativeSelect';

export const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <LabelPrimitive.Root ref={ref} className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)} {...props} />
  ),
);
Label.displayName = 'Label';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />
));
Card.displayName = 'Card';
export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 p-4 pb-2', className)} {...props} />
);
export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-base font-semibold leading-tight', className)} {...props} />
);
export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
);
export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('p-4 pt-2', className)} {...props} />;
export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center gap-2 p-4 pt-0', className)} {...props} />
);

export const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary/10 text-primary',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      success: 'border-transparent bg-success/15 text-success',
      warning: 'border-transparent bg-warning/20 text-warning-foreground dark:text-warning',
      destructive: 'border-transparent bg-destructive/15 text-destructive',
      outline: 'text-foreground',
      info: 'border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300',
      violet: 'border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300',
    },
  },
  defaultVariants: { variant: 'default' },
});
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;
export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const alertVariants = cva('relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:size-4 [&>svg~*]:pl-7', {
  variants: {
    variant: {
      default: 'bg-card text-foreground',
      destructive: 'border-destructive/40 bg-destructive/5 text-destructive [&>svg]:text-destructive',
      warning: 'border-warning/50 bg-warning/10 text-foreground [&>svg]:text-warning',
      success: 'border-success/40 bg-success/5 text-foreground [&>svg]:text-success',
      info: 'border-sky-500/40 bg-sky-500/5 text-foreground [&>svg]:text-sky-600',
    },
  },
  defaultVariants: { variant: 'default' },
});
export function Alert({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
export const AlertTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h5 className={cn('mb-1 font-medium leading-none', className)} {...props} />
);
export const AlertDescription = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
);

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
    {...props}
  />
));
Separator.displayName = 'Separator';

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
));
Table.displayName = 'Table';
export const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('bg-muted/50 [&_tr]:border-b', className)} {...props} />
);
export const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);
export const TableFooter = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tfoot className={cn('border-t bg-muted/50 font-medium', className)} {...props} />
);
export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-b transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted', className)} {...props} />
);
export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)} {...props} />
);
export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />
);
