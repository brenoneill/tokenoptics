import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton, SkeletonBadge } from "@/components/ui/Skeleton";

function ConversationCardSkeleton() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={<Skeleton className="h-4 w-3/4" />}
        right={<SkeletonBadge className="w-14" />}
      />
      <CardBody className="flex flex-1 flex-col space-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/5" />
        </div>
        <div className="mt-auto grid grid-cols-3 gap-3 border-t border-border-muted pt-3">
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
        <Skeleton className="h-3 w-24" />
      </CardBody>
    </Card>
  );
}

export function ConversationsPageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="pt-4 pb-4">
        <div className="mb-6 flex items-start justify-between gap-6 border-b border-border pb-5">
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3 w-72" />
            <div className="flex flex-wrap gap-2">
              <SkeletonBadge />
              <SkeletonBadge />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ConversationCardSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">Loading conversations…</span>
    </div>
  );
}
