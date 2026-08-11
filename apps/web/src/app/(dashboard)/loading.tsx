import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/shared/table-skeleton";

// Fallback genérico — cobre qualquer rota do grupo (dashboard) sem um
// loading.tsx próprio (Next.js escolhe o mais específico automaticamente).
export default function DashboardGroupLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-64" />
      </div>
      <TableSkeleton />
    </div>
  );
}
