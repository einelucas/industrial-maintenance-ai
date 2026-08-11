import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export default function EquipmentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <TableSkeleton columns={7} />
    </div>
  );
}
