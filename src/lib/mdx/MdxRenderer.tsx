import React from "react";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Spinner } from "../../components/ui/spinner";
import { cn } from "../utils";
import { mdxComponents } from "./mdx-components";

type MdxRendererProps = {
  source: string;
  className?: string;
  components?: Record<string, React.ComponentType<any>>;
};

export function MdxRenderer({
  source,
  className,
  components,
}: MdxRendererProps) {
  const [Component, setComponent] =
    React.useState<React.ComponentType<any> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const mergedComponents = React.useMemo(
    () => ({ ...mdxComponents, ...(components || {}) }),
    [components],
  );

  React.useEffect(() => {
    let cancelled = false;
    if (!source.trim()) {
      setComponent(null);
      setError(null);
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const compiled = await evaluate(source, {
          ...runtime,
          baseUrl: import.meta.url,
          remarkPlugins: [remarkGfm],
        });
        if (!cancelled) {
          setComponent(() => compiled.default);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setComponent(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!source.trim()) {
    return (
      <div className="text-sm text-muted-foreground">No MDX content yet.</div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  if (!Component) {
    return null;
  }

  return (
    <ScrollArea className={cn("h-full", className)} type="always">
      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground">
        <Component components={mergedComponents} />
      </div>
    </ScrollArea>
  );
}
