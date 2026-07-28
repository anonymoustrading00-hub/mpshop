import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-slate-100/80 text-muted-foreground inline-flex h-10 w-fit items-center justify-center rounded-xl p-1 shadow-inner",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-white dark:data-[state=active]:text-foreground focus-visible:border-blue-500 focus-visible:ring-blue-500/30 focus-visible:outline-none dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-slate-500 dark:text-muted-foreground inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-all duration-200 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-slate-900 data-[state=active]:shadow-md data-[state=active]:border-blue-100 hover:text-slate-700 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
