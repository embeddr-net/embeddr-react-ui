import React from "react";
import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import {
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@embeddr/react-ui";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Separator } from "../../components/ui/separator";
import { cn } from "../utils";
import {
  EmbeddrArtifact,
  EmbeddrImage,
  VideoPlayer,
} from "../../components/embeddr";
import { resolveRenderable } from "../renderables";
import { useOptionalEmbeddrAPI } from "../../context/EmbeddrContext";

type CalloutType = "info" | "success" | "warning" | "tip";

type CalloutProps = {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
};

const CALLOUT_STYLES: Record<CalloutType, string> = {
  info: "border-primary/30 bg-primary/10 text-foreground",
  success: "border-emerald-500/30 bg-emerald-500/10 text-foreground",
  warning: "border-amber-500/30 bg-amber-500/10 text-foreground",
  tip: "border-secondary/40 bg-secondary/20 text-foreground",
};

const CALLOUT_ICONS: Record<CalloutType, React.ReactNode> = {
  info: <Info className="size-4 text-primary" />,
  success: <CheckCircle2 className="size-4 text-emerald-500" />,
  warning: <AlertTriangle className="size-4 text-amber-500" />,
  tip: <Sparkles className="size-4 text-secondary-foreground" />,
};

export const Callout = ({ type = "info", title, children }: CalloutProps) => (
  <Card className={cn("p-3 border", CALLOUT_STYLES[type])}>
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{CALLOUT_ICONS[type]}</div>
      <div className="space-y-1">
        {title ? <div className="text-sm font-semibold">{title}</div> : null}
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  </Card>
);

export const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
    {children}
  </kbd>
);

type RenderableProps = {
  item?: Record<string, any>;
  type?: string;
  url?: string;
  id?: string;
  [key: string]: any;
};

export const Renderable = ({
  item,
  type,
  url,
  id,
  ...rest
}: RenderableProps) => {
  const api = useOptionalEmbeddrAPI();
  const payload = item ?? { id, type, url, ...rest };
  const descriptor = resolveRenderable(payload, { api });

  if (!descriptor) {
    return (
      <div className="text-xs text-muted-foreground">
        No renderable found for this item.
      </div>
    );
  }

  const Renderer = descriptor.render;
  return <Renderer api={api} item={payload} context={{ api }} />;
};

export const mdxComponents: Record<string, React.ComponentType<any>> = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      className="text-primary underline underline-offset-4 hover:text-primary/80"
      target={props.target ?? "_blank"}
      rel={props.rel ?? "noreferrer"}
    />
  ),
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 {...props} className="text-2xl font-semibold text-foreground" />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props} className="text-xl font-semibold text-foreground" />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props} className="text-lg font-semibold text-foreground" />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 {...props} className="text-base font-semibold text-foreground" />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="text-sm text-foreground" />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      {...props}
      className="border-l-2 border-primary/40 pl-4 text-muted-foreground"
    />
  ),
  text: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} />,
  Text: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} />,
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code {...props} className="rounded bg-secondary/40 px-1 py-0.5 text-xs" />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...props}
      className="rounded-md bg-secondary/30 p-3 text-xs overflow-auto"
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className="list-disc pl-5" />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol {...props} className="list-decimal pl-5" />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li {...props} className="marker:text-primary/60" />
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr {...props} className="border-border/60" />
  ),
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="w-full overflow-auto">
      <table {...props} className="w-full text-sm" />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead {...props} className="border-b border-border/60" />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th {...props} className="px-2 py-1 text-left font-semibold" />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td {...props} className="px-2 py-1 text-muted-foreground" />
  ),
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} className="rounded-md border border-border/60 shadow-sm" />
  ),
  Badge,
  Button,
  Progress,
  Card,
  CardTitle,
  CardContent,
  CardDescription,
  CardHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Separator,
  Callout,
  Kbd,
  Renderable,
  EmbeddrImage: EmbeddrImage as React.ComponentType<any>,
  EmbeddrArtifact: EmbeddrArtifact as React.ComponentType<any>,
  VideoPlayer: VideoPlayer as React.ComponentType<any>,
};
