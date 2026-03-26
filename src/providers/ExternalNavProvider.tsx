import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "../components/ui";
import { ExternalNavContext } from "../hooks/useExternalNav";

export function ExternalNavProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState<string | null>(null);

  function openExternal(url: string, skipConfirmation = false, newTab = true) {
    if (skipConfirmation) {
      const features = newTab ? "noopener,noreferrer" : "";
      window.open(url, newTab ? "_blank" : "", features);
      return;
    }
    setHref(url);
    setOpen(true);
  }

  function cancel() {
    setOpen(false);
    setHref(null);
  }

  function confirm() {
    if (href) {
      const features = "noopener,noreferrer";
      window.open(href, "_blank", features);
    }
    setOpen(false);
    setHref(null);
  }

  return (
    <ExternalNavContext.Provider value={{ openExternal }}>
      {/* ⬅️ children are OUTSIDE the Dialog */}
      {children}

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : cancel())}>
        <DialogContent className="max-w-md overflow-hidden">
          <DialogTitle>Leaving site</DialogTitle>

          <DialogDescription>
            You are about to open an external site. Continue?
          </DialogDescription>

          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block text-sm truncate underline"
            >
              {href}
            </a>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={confirm}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ExternalNavContext.Provider>
  );
}
