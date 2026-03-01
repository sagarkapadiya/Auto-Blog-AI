"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ICONS, APP_NAME } from "@/lib/constants";

export default function Sidebar() {
    const pathname = usePathname();
    const { user, isAdmin, logout } = useAuth();

    const navItems = [
        { id: "/dashboard", label: "Dashboard", icon: ICONS.Dashboard },
        { id: "/dashboard/topics", label: "Topic Hub", icon: ICONS.Topics },
        { id: "/dashboard/review", label: "Review Blogs", icon: ICONS.Review },
        { id: "/dashboard/published", label: "Published", icon: ICONS.External },
        { id: "/dashboard/change-password", label: "Change Password", icon: ICONS.Lock },
    ];

    if (isAdmin) {
        navItems.push({ id: "/dashboard/admin", label: "Admin Panel", icon: ICONS.Shield });
    }

    return (
        <div className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col fixed left-0 top-0 z-40">
            <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800">{APP_NAME}</h1>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.id || (item.id !== "/dashboard" && pathname.startsWith(item.id));
                    return (
                        <Link
                            key={item.id}
                            href={item.id}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                ? "bg-indigo-50 text-indigo-700 font-semibold"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-200">
                <div className="flex items-center gap-3 px-2 mb-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                        {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-slate-700 truncate">{user?.name || "User"}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${isAdmin ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                            }`}>
                            {user?.role || "USER"}
                        </span>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all text-sm font-medium"
                >
                    <ICONS.Logout className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
