import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  compact?: boolean;
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  showPageSizeSelector = true,
  compact = false,
}: TablePaginationProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Safe page navigation with bounds checking
  const goToPage = (target: number) => {
    const safePage = Math.min(Math.max(1, target), Math.max(1, totalPages));
    onPageChange(safePage);
  };

  if (totalPages <= 1 && !showPageSizeSelector) {
    return null;
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${compact ? '' : 'sm:justify-between'}`}>
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
          {totalItems > 0 ? (
            <><span className="hidden sm:inline">Showing </span>{startItem.toLocaleString()}-{endItem.toLocaleString()} of {totalItems.toLocaleString()}</>
          ) : (
            'No items'
          )}
        </span>
        
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">Per page:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(parseInt(value))}
            >
              <SelectTrigger className="w-[60px] sm:w-[70px] h-7 sm:h-8 text-xs sm:text-sm" data-testid="page-size-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1 justify-between sm:justify-end">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              data-testid="pagination-first"
            >
              <ChevronsLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              data-testid="pagination-prev"
            >
              <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
          
          <span className="text-xs sm:text-sm px-2 sm:px-3 whitespace-nowrap">
            {currentPage}/{totalPages}
          </span>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              data-testid="pagination-next"
            >
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              data-testid="pagination-last"
            >
              <ChevronsRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
