import { type ReactNode, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => string | number;
  sortable?: boolean;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  pageSize = 10,
  emptyMessage = "Nenhum registro encontrado",
  onRowClick,
  rowClassName,
}: {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.accessor) return data;
    return [...data].sort((a, b) => {
      const va = col.accessor!(a);
      const vb = col.accessor!(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, columns, sortKey, sortDir]);

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key}>
                {c.sortable ? (
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.header}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                ) : c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-10">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            pageData.map((row) => (
              <TableRow
                key={row.id}
                className={cn(onRowClick ? "cursor-pointer" : "", rowClassName?.(row) ?? "")}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((c) => (
                  <TableCell key={c.key}>
                    {c.render ? c.render(row) : (c.accessor ? c.accessor(row) : "")}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground border-t">
        <span>{total} registro(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>Página {page} de {pages}</span>
          <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
