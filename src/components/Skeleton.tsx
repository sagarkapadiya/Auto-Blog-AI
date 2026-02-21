export function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />;
}

export function Spinner({ className = "w-5 h-5" }: { className?: string }) {
    return <div className={`border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />;
}

export function StatCardSkeleton() {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <Skeleton className="h-4 w-24 mb-4 rounded-md" />
            <Skeleton className="h-10 w-16 rounded-lg" />
        </div>
    );
}

export function TableRowSkeleton({ cols = 3 }: { cols?: number }) {
    return (
        <tr>
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-6 py-4">
                    <Skeleton className={`h-4 rounded-md ${i === 0 ? "w-48" : "w-24"}`} />
                </td>
            ))}
        </tr>
    );
}

export function BlogCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
            <Skeleton className="h-48 rounded-none" />
            <div className="p-6 flex-1 space-y-3">
                <Skeleton className="h-5 w-3/4 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
                <Skeleton className="h-9 w-full rounded-xl" />
            </div>
        </div>
    );
}

export function PublishedRowSkeleton() {
    return (
        <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-6">
                <Skeleton className="w-20 h-20 rounded-xl" />
                <div className="space-y-2">
                    <Skeleton className="h-5 w-64 rounded-md" />
                    <Skeleton className="h-3 w-40 rounded-md" />
                    <div className="flex gap-2">
                        <Skeleton className="h-4 w-12 rounded-md" />
                        <Skeleton className="h-4 w-12 rounded-md" />
                        <Skeleton className="h-4 w-12 rounded-md" />
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-9 w-16 rounded-xl" />
                <Skeleton className="h-9 w-16 rounded-xl" />
            </div>
        </div>
    );
}

export function SettingsFormSkeleton() {
    return (
        <div className="space-y-6">
            {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                </div>
            ))}
        </div>
    );
}

export function FullPageLoader({ message = "Processing..." }: { message?: string }) {
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white rounded-3xl p-10 shadow-2xl flex flex-col items-center gap-5 max-w-sm w-full mx-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-700 font-semibold text-center">{message}</p>
                <p className="text-slate-400 text-sm text-center">Please wait, this may take a moment...</p>
            </div>
        </div>
    );
}
