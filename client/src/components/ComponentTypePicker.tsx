import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronDown, X, Flame, Zap, Droplets, Shield, Wind, Building2, Wrench, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComponentType {
  id: string;
  name: string;
  category: string;
}

interface ComponentTypePickerProps {
  componentTypes: ComponentType[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Gas": <Flame className="h-4 w-4 text-orange-500" />,
  "Electrical": <Zap className="h-4 w-4 text-yellow-500" />,
  "Water": <Droplets className="h-4 w-4 text-blue-500" />,
  "Fire Safety": <Shield className="h-4 w-4 text-red-500" />,
  "Ventilation": <Wind className="h-4 w-4 text-cyan-500" />,
  "Building": <Building2 className="h-4 w-4 text-gray-500" />,
  "General": <Wrench className="h-4 w-4 text-gray-500" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Gas": "bg-orange-100 text-orange-700 hover:bg-orange-200",
  "Electrical": "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
  "Water": "bg-blue-100 text-blue-700 hover:bg-blue-200",
  "Fire Safety": "bg-red-100 text-red-700 hover:bg-red-200",
  "Ventilation": "bg-cyan-100 text-cyan-700 hover:bg-cyan-200",
  "Building": "bg-gray-100 text-gray-700 hover:bg-gray-200",
  "General": "bg-slate-100 text-slate-700 hover:bg-slate-200",
};

const RECENT_TYPES_KEY = "complianceai-recent-component-types";
const MAX_RECENT = 5;

function getRecentTypes(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_TYPES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentType(typeId: string) {
  try {
    const recent = getRecentTypes().filter(id => id !== typeId);
    recent.unshift(typeId);
    localStorage.setItem(RECENT_TYPES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
  }
}

export function ComponentTypePicker({
  componentTypes,
  value,
  onValueChange,
  placeholder = "Select component type...",
  className,
  "data-testid": testId,
}: ComponentTypePickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const groupedTypes = useMemo(() => {
    const groups: Record<string, ComponentType[]> = {};
    
    componentTypes.forEach(type => {
      const category = type.category || "General";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(type);
    });

    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return groups;
  }, [componentTypes]);

  const categories = useMemo(() => {
    return Object.keys(groupedTypes).sort();
  }, [groupedTypes]);

  const recentTypes = useMemo(() => {
    const recentIds = getRecentTypes();
    return recentIds
      .map(id => componentTypes.find(t => t.id === id))
      .filter((t): t is ComponentType => t !== undefined);
  }, [componentTypes]);

  const filteredTypes = useMemo(() => {
    let types = componentTypes;
    
    if (categoryFilter) {
      types = types.filter(t => t.category === categoryFilter);
    }
    
    return types;
  }, [componentTypes, categoryFilter]);

  const selectedType = useMemo(() => {
    if (value === "all") return null;
    return componentTypes.find(t => t.id === value);
  }, [componentTypes, value]);

  const handleSelect = useCallback((typeId: string) => {
    if (typeId !== "all") {
      saveRecentType(typeId);
    }
    onValueChange(typeId);
    setOpen(false);
    setSearchQuery("");
    setCategoryFilter(null);
  }, [onValueChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange("all");
  }, [onValueChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-48 justify-between", className)}
          data-testid={testId}
        >
          {selectedType ? (
            <span className="flex items-center gap-2 truncate">
              {CATEGORY_ICONS[selectedType.category] || <Wrench className="h-4 w-4" />}
              <span className="truncate">{selectedType.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <div className="flex items-center gap-1 ml-2">
            {selectedType && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput 
            placeholder="Search component types..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
            data-testid="input-component-type-search"
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>No component types found.</CommandEmpty>
            
            <div className="p-2 flex flex-wrap gap-1 border-b">
              <Badge
                variant={categoryFilter === null ? "default" : "outline"}
                className={cn(
                  "cursor-pointer text-xs",
                  categoryFilter === null ? "" : "hover:bg-accent"
                )}
                onClick={() => setCategoryFilter(null)}
                data-testid="badge-category-all"
              >
                All
              </Badge>
              {categories.map(category => (
                <Badge
                  key={category}
                  variant="outline"
                  className={cn(
                    "cursor-pointer text-xs transition-colors",
                    categoryFilter === category 
                      ? CATEGORY_COLORS[category] || "bg-primary/10"
                      : "hover:bg-accent"
                  )}
                  onClick={() => setCategoryFilter(categoryFilter === category ? null : category)}
                  data-testid={`badge-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {CATEGORY_ICONS[category]}
                  {category} ({groupedTypes[category]?.length || 0})
                </Badge>
              ))}
            </div>
            
            <CommandItem
              value="all-types"
              onSelect={() => handleSelect("all")}
              className="flex items-center gap-2"
              data-testid="item-all-types"
            >
              <Check
                className={cn(
                  "h-4 w-4",
                  value === "all" ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="font-medium">All Types</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {componentTypes.length} total
              </span>
            </CommandItem>

            {recentTypes.length > 0 && !searchQuery && !categoryFilter && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recent">
                  {recentTypes.map(type => (
                    <CommandItem
                      key={`recent-${type.id}`}
                      value={`recent-${type.name}`}
                      onSelect={() => handleSelect(type.id)}
                      className="flex items-center gap-2"
                      data-testid={`item-recent-${type.id}`}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          value === type.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {CATEGORY_ICONS[type.category] || <Wrench className="h-4 w-4" />}
                      <span>{type.name}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {type.category}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            
            {categoryFilter ? (
              <CommandGroup heading={categoryFilter}>
                {filteredTypes.map(type => (
                  <CommandItem
                    key={type.id}
                    value={type.name}
                    onSelect={() => handleSelect(type.id)}
                    className="flex items-center gap-2"
                    data-testid={`item-type-${type.id}`}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === type.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {CATEGORY_ICONS[type.category] || <Wrench className="h-4 w-4" />}
                    <span>{type.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              categories.map(category => (
                <CommandGroup key={category} heading={category}>
                  {groupedTypes[category].map(type => (
                    <CommandItem
                      key={type.id}
                      value={type.name}
                      onSelect={() => handleSelect(type.id)}
                      className="flex items-center gap-2"
                      data-testid={`item-type-${type.id}`}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          value === type.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {CATEGORY_ICONS[type.category] || <Wrench className="h-4 w-4" />}
                      <span>{type.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
