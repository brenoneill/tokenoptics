import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton, SkeletonBadge } from "@/components/ui/Skeleton";

export function ConversationDetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="mb-6 flex items-start justify-between gap-6 border-b border-border pb-5">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-3 w-80" />
          <div className="flex flex-wrap gap-2">
            <SkeletonBadge />
            <SkeletonBadge className="w-24" />
            <SkeletonBadge className="w-28" />
            <SkeletonBadge className="w-24" />
          </div>
        </div>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-9/12" />
        </CardBody>
      </Card>
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-10/12" />
          <Skeleton className="h-24 w-full" />
        </CardBody>
      </Card>
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-8/12" />
        </CardBody>
      </Card>
      <span className="sr-only">Loading conversation…</span>
    </div>
  );
}
