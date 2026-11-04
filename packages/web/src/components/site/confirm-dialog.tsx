'use client';

import { useEffect, useRef, type ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * A question that must be answered before something is done: a small centred
 * dialog on the browser's own `<dialog>`, in place of `window.confirm()`. Focus
 * is trapped, Escape and a click outside cancel, and focus starts on Cancel,
 * the safe choice. It is controlled by its parent, which does the work when
 * `onConfirm` is called and closes it.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The question: "Remove example.com?". */
  title: string;
  /** What will happen, and what will not. */
  description: string;
  /** The button that goes ahead: "Remove domain". */
  confirmLabel: string;
  onConfirm: () => void;
}>): ReactElement {
  const cancel = useRef<HTMLButtonElement>(null);

  // Move focus to Cancel (the safe choice) once the dialog is showing.
  useEffect(() => {
    if (open) {
      cancel.current?.focus();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="center" showClose={false} className="p-6">
        <DialogTitle className="font-display text-xl font-semibold">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-muted">
          {description}
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            ref={cancel}
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
