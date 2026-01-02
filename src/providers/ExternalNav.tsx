import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { ExternalNavContext } from "../hooks/useExternalNav";

export function ExternalNavProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState<string | null>(null);

  function openExternal(url: string) {
    setHref(url);
    setOpen(true);
  }

  function cancel() {
    setOpen(false);
    setHref(null);
  }

  function confirm() {
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
    setOpen(false);
    setHref(null);
  }

  return (
    <ExternalNavContext.Provider value={{ openExternal }}>
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : cancel())}>
        <DialogContent className="dark max-w-md overflow-hidden">
          <DialogTitle>Leaving site</DialogTitle>
          <DialogDescription>
            You are about to open an external site. This will take you off this
            page. Continue?
            <Button
              className="p-2 mt-4 flex hover:bg-muted/50 bg-muted/20 text-foreground border w-full hover:underline! justify-start"
              variant="link"
              size="sm"
              asChild
            >
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  {href}
                </a>
              )}
            </Button>
          </DialogDescription>
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
