import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50 flex">
                <Sidebar />
                <main className="ml-64 flex-1 p-10 max-w-7xl mx-auto">
                    {children}
                </main>
            </div>
        </ProtectedRoute>
    );
}
