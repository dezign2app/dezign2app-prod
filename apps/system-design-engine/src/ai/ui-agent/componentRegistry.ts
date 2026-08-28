/**
 * UI Component Registry & Design System Knowledge for LangGraph UI Editor
 * 
 * Provides full metadata, exported subcomponents, import paths, and usage guidelines
 * for all @workspace/ui components available in the monorepo design system.
 */

export interface ComponentDefinition {
  name: string;
  importPath: string;
  exports: string[];
  description: string;
  propsDescription?: string;
  usageSnippet?: string;
}

export const COMPONENT_REGISTRY: Record<string, ComponentDefinition> = {
  button: {
    name: "Button",
    importPath: "@workspace/ui/components/button",
    exports: ["Button", "buttonVariants"],
    description: "Interactive button element with variant and size options.",
    propsDescription: "variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'; size: 'default' | 'sm' | 'lg' | 'icon'; disabled?: boolean;",
    usageSnippet: `<Button variant="default" size="sm" onClick={handleClick}><Plus className="w-4 h-4 mr-1.5" /> Add Item</Button>`,
  },
  card: {
    name: "Card",
    importPath: "@workspace/ui/components/card",
    exports: ["Card", "CardHeader", "CardTitle", "CardDescription", "CardAction", "CardContent", "CardFooter"],
    description: "Versatile content container with structured header, title, description, content, action, and footer.",
    usageSnippet: `<Card className="shadow-sm border-border bg-card">
  <CardHeader>
    <CardTitle>Analytics Overview</CardTitle>
    <CardDescription>Key metrics for the last 30 days</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold text-foreground">12,450</div>
  </CardContent>
  <CardFooter className="text-xs text-muted-foreground">Updated 5 minutes ago</CardFooter>
</Card>`,
  },
  badge: {
    name: "Badge",
    importPath: "@workspace/ui/components/badge",
    exports: ["Badge", "badgeVariants"],
    description: "Small status indicator or tag.",
    propsDescription: "variant: 'default' | 'secondary' | 'destructive' | 'outline';",
    usageSnippet: `<Badge variant="secondary" className="text-xs">Active</Badge>`,
  },
  input: {
    name: "Input",
    importPath: "@workspace/ui/components/input",
    exports: ["Input"],
    description: "Text input field styled with focus rings and placeholder styling.",
    usageSnippet: `<Input type="text" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />`,
  },
  textarea: {
    name: "Textarea",
    importPath: "@workspace/ui/components/textarea",
    exports: ["Textarea"],
    description: "Multi-line text input field.",
    usageSnippet: `<Textarea placeholder="Enter notes..." rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />`,
  },
  table: {
    name: "Table",
    importPath: "@workspace/ui/components/table",
    exports: ["Table", "TableHeader", "TableBody", "TableFooter", "TableHead", "TableRow", "TableCell", "TableCaption"],
    description: "Clean tabular data display with responsive container and hover highlights.",
    usageSnippet: `<div className="rounded-md border border-border overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Amount</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
          <TableCell className="text-right">{item.amount}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>`,
  },
  tabs: {
    name: "Tabs",
    importPath: "@workspace/ui/components/tabs",
    exports: ["Tabs", "TabsList", "TabsTrigger", "TabsContent"],
    description: "Tabbed navigation interface.",
    usageSnippet: `<Tabs defaultValue="overview" className="w-full">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="overview" className="pt-4">Overview panel</TabsContent>
  <TabsContent value="analytics" className="pt-4">Analytics panel</TabsContent>
  <TabsContent value="settings" className="pt-4">Settings panel</TabsContent>
</Tabs>`,
  },
  dialog: {
    name: "Dialog",
    importPath: "@workspace/ui/components/dialog",
    exports: ["Dialog", "DialogTrigger", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter", "DialogClose"],
    description: "Modal dialog overlay for focused workflows.",
    usageSnippet: `<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Open Modal</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogDescription>Update your account details below.</DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <Input placeholder="Full Name" />
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button onClick={handleSave}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`,
  },
  sheet: {
    name: "Sheet",
    importPath: "@workspace/ui/components/sheet",
    exports: ["Sheet", "SheetTrigger", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "SheetFooter", "SheetClose"],
    description: "Slide-out drawer panel from screen edges (left/right/top/bottom).",
    usageSnippet: `<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetTrigger asChild>
    <Button variant="outline">Filters</Button>
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Filter Options</SheetTitle>
      <SheetDescription>Refine the search results.</SheetDescription>
    </SheetHeader>
  </SheetContent>
</Sheet>`,
  },
  select: {
    name: "Select",
    importPath: "@workspace/ui/components/select",
    exports: ["Select", "SelectGroup", "SelectValue", "SelectTrigger", "SelectContent", "SelectLabel", "SelectItem", "SelectSeparator"],
    description: "Custom styled dropdown select.",
    usageSnippet: `<Select value={selected} onValueChange={setSelected}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select status" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectItem value="all">All</SelectItem>
      <SelectItem value="active">Active</SelectItem>
      <SelectItem value="archived">Archived</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>`,
  },
  dropdownMenu: {
    name: "DropdownMenu",
    importPath: "@workspace/ui/components/dropdown-menu",
    exports: ["DropdownMenu", "DropdownMenuTrigger", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuLabel", "DropdownMenuSeparator", "DropdownMenuGroup"],
    description: "Contextual actions dropdown menu.",
    usageSnippet: `<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-destructive" onClick={handleDelete}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
  },
  avatar: {
    name: "Avatar",
    importPath: "@workspace/ui/components/avatar",
    exports: ["Avatar", "AvatarImage", "AvatarFallback"],
    description: "User avatar with fallback initials.",
    usageSnippet: `<Avatar className="h-9 w-9">
  <AvatarImage src="/avatar.png" alt="User" />
  <AvatarFallback className="bg-primary/10 text-primary font-semibold">JD</AvatarFallback>
</Avatar>`,
  },
  skeleton: {
    name: "Skeleton",
    importPath: "@workspace/ui/components/skeleton",
    exports: ["Skeleton"],
    description: "Shimmer loading placeholder.",
    usageSnippet: `<div className="space-y-2">
  <Skeleton className="h-4 w-[250px]" />
  <Skeleton className="h-4 w-[200px]" />
</div>`,
  },
  progress: {
    name: "Progress",
    importPath: "@workspace/ui/components/progress",
    exports: ["Progress"],
    description: "Progress bar indicator.",
    usageSnippet: `<Progress value={65} className="w-full h-2" />`,
  },
  switch: {
    name: "Switch",
    importPath: "@workspace/ui/components/switch",
    exports: ["Switch"],
    description: "Toggle switch control.",
    usageSnippet: `<div className="flex items-center space-x-2">
  <Switch id="dark-mode" checked={enabled} onCheckedChange={setEnabled} />
  <Label htmlFor="dark-mode">Enable notifications</Label>
</div>`,
  },
  checkbox: {
    name: "Checkbox",
    importPath: "@workspace/ui/components/checkbox",
    exports: ["Checkbox"],
    description: "Checkbox toggle control.",
    usageSnippet: `<Checkbox id="terms" checked={checked} onCheckedChange={setChecked} />`,
  },
  tooltip: {
    name: "Tooltip",
    importPath: "@workspace/ui/components/tooltip",
    exports: ["Tooltip", "TooltipTrigger", "TooltipContent", "TooltipProvider"],
    description: "Informative hover tooltip.",
    usageSnippet: `<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon"><Info className="w-4 h-4" /></Button>
    </TooltipTrigger>
    <TooltipContent>Detailed explanation</TooltipContent>
  </Tooltip>
</TooltipProvider>`,
  },
  alert: {
    name: "Alert",
    importPath: "@workspace/ui/components/alert",
    exports: ["Alert", "AlertTitle", "AlertDescription"],
    description: "Callout alert box for status or warnings.",
    usageSnippet: `<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
</Alert>`,
  },
  accordion: {
    name: "Accordion",
    importPath: "@workspace/ui/components/accordion",
    exports: ["Accordion", "AccordionItem", "AccordionTrigger", "AccordionContent"],
    description: "Collapsible disclosure panels.",
    usageSnippet: `<Accordion type="single" collapsible className="w-full">
  <AccordionItem value="item-1">
    <AccordionTrigger>Is it accessible?</AccordionTrigger>
    <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
  </AccordionItem>
</Accordion>`,
  },
  separator: {
    name: "Separator",
    importPath: "@workspace/ui/components/separator",
    exports: ["Separator"],
    description: "Visual horizontal or vertical divider line.",
    usageSnippet: `<Separator className="my-4" />`,
  },
};

/**
 * Returns formatted design system documentation for the LLM prompt.
 */
export function formatComponentCatalog(): string {
  const componentSummaries = Object.values(COMPONENT_REGISTRY)
    .map((comp) => {
      const exportsStr = comp.exports.join(", ");
      return `- **${comp.name}** (Import: \`import { ${exportsStr} } from "${comp.importPath}";\`)
  Description: ${comp.description}
  ${comp.propsDescription ? `Props/Variants: ${comp.propsDescription}\n  ` : ""}Example: \`${comp.usageSnippet?.replace(/\n\s*/g, " ")}\``;
    })
    .join("\n\n");

  return `### Monorepo Design System Components (@workspace/ui)

All standard UI components MUST be imported from \`@workspace/ui/components/<component-name>\` or utility \`cn\` from \`@workspace/ui/lib/utils\`.
Icons should be imported from \`lucide-react\` (e.g. \`import { Search, Plus, Trash, ArrowUpRight, TrendingUp, Filter, MoreVertical, RefreshCw, User, Settings } from "lucide-react";\`).

Available Components:
${componentSummaries}

### Tailwind CSS v4 Theme Tokens
Always use semantic color tokens:
- \`bg-background\` / \`text-foreground\` (Main canvas)
- \`bg-card\` / \`text-card-foreground\` / \`border-border\` (Cards, panels, containers)
- \`bg-primary\` / \`text-primary-foreground\` (Primary actions)
- \`bg-secondary\` / \`text-secondary-foreground\` (Secondary elements)
- \`bg-muted\` / \`text-muted-foreground\` (Subtle backgrounds, captions, metadata)
- \`bg-accent\` / \`text-accent-foreground\` (Hover states)
- \`text-destructive\` / \`bg-destructive/10\` (Delete/error actions)
- \`ring-ring\` / \`outline-ring\` (Focus states)
`;
}
