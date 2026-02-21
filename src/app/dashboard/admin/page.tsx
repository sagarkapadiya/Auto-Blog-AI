"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import AdminGuard from "@/components/AdminGuard";
import { parseCurlCommand } from "@/lib/curlParser";
import { ICONS } from "@/lib/constants";
import { StatCardSkeleton, TableRowSkeleton, Spinner } from "@/components/Skeleton";
import { useToast } from "@/context/ToastContext";
import api from "@/lib/api";

export default function AdminPage() {
    return (
        <AdminGuard>
            <AdminPanel />
        </AdminGuard>
    );
}

function AdminPanel() {
    const { token } = useAuth();
    const { toast } = useToast();
    const [users, setUsers] = useState<any[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            const { data } = await api.get("/admin/users");
            setUsers(data.users || []);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { if (token) fetchUsers(); }, [token, fetchUsers]);

    const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const formData = new FormData(e.currentTarget);
            await api.post("/admin/users", {
                name: formData.get("name"),
                email: formData.get("email"),
                password: formData.get("password"),
                role: formData.get("role"),
                settings: {
                    api_key: formData.get("settings_api_key") || "",
                    curlCommand: formData.get("settings_curlCommand") || "",
                },
            });
            setShowCreateModal(false);
            toast.success("User created successfully!");
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to create user");
        } finally {
            setIsCreating(false);
        }
    };

    const handleEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsEditing(true);
        try {
            const formData = new FormData(e.currentTarget);
            await api.put(`/admin/users/${editingUser._id}`, {
                name: formData.get("name"),
                email: formData.get("email"),
                role: formData.get("role"),
                settings: {
                    api_key: formData.get("settings_api_key") || "",
                    curlCommand: formData.get("settings_curlCommand") || "",
                },
            });
            setEditingUser(null);
            toast.success("User updated successfully!");
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to update user");
        } finally {
            setIsEditing(false);
        }
    };

    const handleToggle = async (userId: string) => {
        setTogglingId(userId);
        try {
            const { data } = await api.patch(`/admin/users/${userId}/toggle`);
            toast.success(data.user?.isActive ? "User activated!" : "User deactivated!");
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to toggle user status");
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Admin Panel</h2>
                    <p className="text-slate-500">Manage all users, roles, and access permissions.</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                    <ICONS.Plus className="w-5 h-5" /> Create User
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
                ) : (
                    <>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Users</span>
                            <div className="text-4xl font-bold mt-2 text-blue-600">{users.length}</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Admins</span>
                            <div className="text-4xl font-bold mt-2 text-amber-600">{users.filter(u => u.role === "ADMIN").length}</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Active Users</span>
                            <div className="text-4xl font-bold mt-2 text-emerald-600">{users.filter(u => u.isActive).length}</div>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-5">User</th>
                            <th className="px-6 py-5">Email</th>
                            <th className="px-6 py-5">Role</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5">Joined</th>
                            <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                        ) : users.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-14 text-center text-slate-400">No users found.</td></tr>
                        ) : users.map((user: any) => (
                            <tr key={user._id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">{user.name?.charAt(0)?.toUpperCase()}</div>
                                        <span className="font-semibold text-slate-800">{user.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-slate-500">{user.email}</td>
                                <td className="px-6 py-5">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.role === "ADMIN" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{user.role}</span>
                                </td>
                                <td className="px-6 py-5">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{user.isActive ? "Active" : "Inactive"}</span>
                                </td>
                                <td className="px-6 py-5 text-slate-500 text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-5 text-right">
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={async () => {
                                            try {
                                                const { data } = await api.get(`/admin/users/${user._id}`);
                                                setEditingUser({ ...data.user, settings: data.settings });
                                            } catch {
                                                toast.error("Failed to load user details");
                                            }
                                        }} className="px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">Edit</button>
                                        <button onClick={() => handleToggle(user._id)} disabled={togglingId === user._id} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${togglingId === user._id ? "border border-slate-200 text-slate-400 cursor-not-allowed" : user.isActive ? "text-rose-600 border border-rose-200 hover:bg-rose-50" : "text-emerald-600 border border-emerald-200 hover:bg-emerald-50"}`}>
                                            {togglingId === user._id && <Spinner className="w-3 h-3" />}
                                            {togglingId === user._id ? "..." : user.isActive ? "Deactivate" : "Activate"}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl my-8">
                        <h3 className="text-2xl font-bold mb-6">Create New User</h3>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Full Name</label>
                                <input name="name" required disabled={isCreating} className="w-full px-4 py-3 border border-slate-200 rounded-2xl disabled:opacity-60" placeholder="John Doe" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Email</label>
                                <input name="email" type="email" required disabled={isCreating} className="w-full px-4 py-3 border border-slate-200 rounded-2xl disabled:opacity-60" placeholder="john@example.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Password</label>
                                <input name="password" type="password" required minLength={6} disabled={isCreating} className="w-full px-4 py-3 border border-slate-200 rounded-2xl disabled:opacity-60" placeholder="Min 6 characters" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Role</label>
                                <select name="role" disabled={isCreating} className="w-full px-4 py-3 border border-slate-200 rounded-2xl bg-white disabled:opacity-60">
                                    <option value="USER">User</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <UserSettingsFields disabled={isCreating} settings={null} />
                            <div className="flex gap-4 mt-8">
                                <button type="button" onClick={() => setShowCreateModal(false)} disabled={isCreating} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                                <button type="submit" disabled={isCreating} className={`flex-1 py-3 font-bold rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 ${isCreating ? "bg-indigo-400 text-white cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                                    {isCreating && <Spinner className="w-4 h-4" />}
                                    {isCreating ? "Creating..." : "Create User"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingUser && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl my-8">
                        <h3 className="text-2xl font-bold mb-6">Edit User</h3>
                        <form onSubmit={handleEditUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Full Name</label>
                                <input name="name" defaultValue={editingUser.name} required disabled={isEditing} className="w-full px-4 py-3 border border-slate-200 rounded-2xl disabled:opacity-60" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Email</label>
                                <input name="email" type="email" defaultValue={editingUser.email} required disabled={isEditing} className="w-full px-4 py-3 border border-slate-200 rounded-2xl disabled:opacity-60" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Role</label>
                                <select name="role" defaultValue={editingUser.role} disabled={isEditing} className="w-full px-4 py-3 border border-slate-200 rounded-2xl bg-white disabled:opacity-60">
                                    <option value="USER">User</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <UserSettingsFields disabled={isEditing} settings={editingUser.settings} />
                            <div className="flex gap-4 mt-8">
                                <button type="button" onClick={() => setEditingUser(null)} disabled={isEditing} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                                <button type="submit" disabled={isEditing} className={`flex-1 py-3 font-bold rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 ${isEditing ? "bg-indigo-400 text-white cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                                    {isEditing && <Spinner className="w-4 h-4" />}
                                    {isEditing ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function UserSettingsFields({ disabled, settings }: { disabled: boolean; settings: { api_key?: string; curlCommand?: string } | null }) {
    const [curlCommand, setCurlCommand] = useState(settings?.curlCommand ?? "");
    useEffect(() => { setCurlCommand(settings?.curlCommand ?? ""); }, [settings?.curlCommand]);
    const parsed = curlCommand?.trim() ? parseCurlCommand(curlCommand) : null;

    return (
        <div className="border-t border-slate-200 pt-6 mt-6 space-y-6">
            <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider">System Configuration</h4>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Sarvam AI API Key</label>
                    <input name="settings_api_key" type="password" defaultValue={settings?.api_key ?? ""} disabled={disabled} placeholder="Enter Sarvam AI Subscription Key" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60" />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Blog Publish API (cURL)</label>
                    <textarea name="settings_curlCommand" value={curlCommand} onChange={(e) => setCurlCommand(e.target.value)} disabled={disabled} placeholder="Paste your cURL command..." rows={5} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs resize-none disabled:opacity-60" />
                    {parsed && parsed.url && (
                        <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Parsed Config</h5>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex gap-2">
                                    <span className="font-semibold text-slate-600 min-w-[60px]">Method:</span>
                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">{parsed.method}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-semibold text-slate-600 min-w-[60px]">URL:</span>
                                    <span className="text-slate-700 break-all text-xs">{parsed.url}</span>
                                </div>
                                {Object.keys(parsed.headers || {}).length > 0 && (
                                    <div>
                                        <span className="font-semibold text-slate-600">Headers:</span>
                                        <div className="mt-1 space-y-0.5">
                                            {Object.entries(parsed.headers).map(([k, v]) => (
                                                <div key={k} className="text-xs text-slate-500 font-mono pl-2">{k}: {String(v).length > 30 ? String(v).slice(0, 30) + "..." : v}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {parsed.bodyTemplate && (
                                    <div>
                                        <span className="font-semibold text-slate-600">Body Fields:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {Object.keys(parsed.bodyTemplate).map(key => (
                                                <span key={key} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold">{key}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
