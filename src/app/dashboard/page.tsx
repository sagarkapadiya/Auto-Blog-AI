"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { ICONS } from "@/lib/constants";
import { StatCardSkeleton, TableRowSkeleton, Spinner } from "@/components/Skeleton";
import { useToast } from "@/context/ToastContext";
import api from "@/lib/api";

function computeMinDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5, 0, 0);
    return now.toISOString().slice(0, 16);
}

export default function DashboardPage() {
    const { token } = useAuth();
    const { toast } = useToast();
    const [stats, setStats] = useState({ totalTopics: 0, pendingReview: 0, publishedTotal: 0, todayGenerated: 0 });
    const [topics, setTopics] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAddTopic, setShowAddTopic] = useState(false);
    const [enableSchedule, setEnableSchedule] = useState(false);
    const [scheduleError, setScheduleError] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [minDateTime, setMinDateTime] = useState(computeMinDateTime);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [isAddingTopic, setIsAddingTopic] = useState(false);

    useEffect(() => {
        if (!enableSchedule) return;
        const timer = setInterval(() => setMinDateTime(computeMinDateTime()), 30_000);
        setMinDateTime(computeMinDateTime());
        return () => clearInterval(timer);
    }, [enableSchedule]);

    const refreshData = useCallback(async () => {
        try {
            const [statsRes, topicsRes, settingsRes] = await Promise.all([
                api.get("/dashboard"),
                api.get("/topics"),
                api.get("/settings"),
            ]);
            setStats(statsRes.data.stats || stats);
            setTopics(topicsRes.data.topics || []);
            setSettings(settingsRes.data.settings || null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { if (token) refreshData(); }, [token, refreshData]);

    const handleRunScheduler = async () => {
        setIsGenerating(true);
        try {
            const { data } = await api.post("/cron/generate");
            const count = data?.topics?.length ?? 0;
            toast.success(count > 0 ? `Generated ${count} blog(s) successfully!` : data?.message || "No scheduled topics due.");
            refreshData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || error.message || "Error running scheduled task");
        } finally {
            setIsGenerating(false);
        }
    };

    const validateScheduledTime = (value: string): string | null => {
        if (!value) return null;
        const selected = new Date(value);
        const minAllowed = new Date();
        minAllowed.setMinutes(minAllowed.getMinutes() + 5, 0, 0);
        if (selected < minAllowed) return "Scheduled time must be at least 5 minutes from now";
        return null;
    };

    const handleScheduleChange = (value: string) => {
        setScheduledAt(value);
        setScheduleError(validateScheduledTime(value) || "");
    };

    const handleAddTopic = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setScheduleError("");
        if (enableSchedule) {
            if (!scheduledAt) { setScheduleError("Please select a date and time"); return; }
            const error = validateScheduledTime(scheduledAt);
            if (error) { setScheduleError(error); return; }
        }
        setIsAddingTopic(true);
        const formData = new FormData(e.currentTarget);
        try {
            await api.post("/topics", {
                title: formData.get("title") as string,
                category: formData.get("category") as string,
                keywords: (formData.get("keywords") as string).split(",").map(k => k.trim()),
                targetAudience: formData.get("audience") as string,
                scheduledAt: enableSchedule && scheduledAt ? scheduledAt : null,
            });
            setShowAddTopic(false);
            setEnableSchedule(false);
            setScheduleError("");
            setScheduledAt("");
            toast.success(enableSchedule ? "Topic scheduled successfully!" : "Topic added to queue!");
            refreshData();
        } catch (error: any) {
            setScheduleError(error.response?.data?.error || "Failed to create topic");
        } finally {
            setIsAddingTopic(false);
        }
    };

    const handleImportCSV = async () => {
        setIsImporting(true);
        try {
            const dummyTopics = [
                { title: "Top 10 AI Tools for SaaS", category: "AI", keywords: ["AI", "SaaS", "Tools"], targetAudience: "Startup Founders" },
                { title: "Building a React App with Gemini", category: "Dev", keywords: ["React", "Gemini", "API"], targetAudience: "Developers" },
                { title: "The Future of Content Marketing", category: "Marketing", keywords: ["SEO", "Content", "2025"], targetAudience: "Marketers" },
            ];
            for (const t of dummyTopics) {
                await api.post("/topics", t);
            }
            refreshData();
            toast.success("Imported 3 sample topics!");
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Welcome Back, Editor</h2>
                    <p className="text-slate-500 mt-1">Here&apos;s what&apos;s happening with your blog automation today.</p>
                </div>
                <button onClick={handleRunScheduler} disabled={isGenerating} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all ${isGenerating ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"}`}>
                    {isGenerating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ICONS.Clock className="w-5 h-5" />}
                    {isGenerating ? "Generating Content..." : "Run Scheduled Task Now"}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {isLoading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : [
                    { label: "Total Topics", value: stats.totalTopics, color: "text-blue-600" },
                    { label: "Pending Review", value: stats.pendingReview, color: "text-amber-600" },
                    { label: "Live Blogs", value: stats.publishedTotal, color: "text-emerald-600" },
                    { label: "Today Generated", value: stats.todayGenerated, color: "text-indigo-600" },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                        <div className={`text-4xl font-bold mt-2 ${stat.color}`}>{stat.value}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-lg">Recent Topics</h3>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr><th className="px-6 py-4">Title</th><th className="px-6 py-4">Category</th><th className="px-6 py-4">Status</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={3} />) : topics.length === 0 ? (
                                <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400">No topics added yet.</td></tr>
                            ) : topics.slice(0, 5).map((topic: any) => (
                                <tr key={topic._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-800">{topic.title}</td>
                                    <td className="px-6 py-4 text-slate-500">{topic.category}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${topic.status === "PENDING" ? "bg-blue-50 text-blue-600" : topic.status === "GENERATED" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>{topic.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="space-y-6">
                    <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold">Automation Status</h3>
                            <p className="mt-2 text-indigo-100 opacity-90">Your next post is scheduled for tomorrow at {settings?.generationTime || "09:00"}.</p>
                            <div className="mt-6 p-4 bg-white/10 rounded-xl backdrop-blur-md">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                                    <span className="text-sm font-semibold">Scheduler Active</span>
                                </div>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 p-8 opacity-10"><ICONS.Clock className="w-24 h-24" /></div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800">Quick Actions</h3>
                        <div className="mt-4 space-y-3">
                            <button onClick={() => setShowAddTopic(true)} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-700 font-semibold transition-all">
                                <ICONS.Plus className="w-5 h-5 text-indigo-600" /> Add New Topic
                            </button>
                            <button onClick={handleImportCSV} disabled={isImporting} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${isImporting ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-50 hover:bg-slate-100 text-slate-700"}`}>
                                {isImporting ? <Spinner className="w-5 h-5 text-blue-600" /> : <ICONS.Upload className="w-5 h-5 text-blue-600" />}
                                {isImporting ? "Importing..." : "Import Sheet (.CSV)"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showAddTopic && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl">
                        <h3 className="text-2xl font-bold mb-6">Add New Topic</h3>
                        <form onSubmit={handleAddTopic} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Topic Title</label>
                                <input name="title" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="e.g. The Impact of Quantum Computing" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Category</label>
                                    <input name="category" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="Tech" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Target Audience</label>
                                    <input name="audience" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="Professionals" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Keywords (Comma separated)</label>
                                <input name="keywords" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="crypto, safety, tech 2024" />
                            </div>
                            <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div onClick={() => setEnableSchedule(!enableSchedule)} className={`relative w-10 h-5 rounded-full transition-colors ${enableSchedule ? "bg-indigo-600" : "bg-slate-200"}`}>
                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enableSchedule ? "translate-x-5" : ""}`} />
                                    </div>
                                    <div>
                                        <span className="text-sm font-semibold text-slate-700">Schedule Auto-Generation</span>
                                        <p className="text-xs text-slate-400">Set a future date & time for automatic blog generation</p>
                                    </div>
                                </label>
                                {enableSchedule && (
                                    <div>
                                        <input type="datetime-local" name="scheduledAt" value={scheduledAt} onChange={(e) => handleScheduleChange(e.target.value)} required={enableSchedule} min={minDateTime} className={`w-full px-4 py-3 border rounded-2xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none ${scheduleError ? "border-rose-300 bg-rose-50/50" : "border-slate-200"}`} />
                                        <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${scheduleError ? "text-rose-500" : "text-slate-400"}`}>
                                            <ICONS.Clock className="w-3 h-3" /> {scheduleError || "Must be at least 5 minutes from now"}
                                        </p>
                                    </div>
                                )}
                            </div>
                            {scheduleError && <p className="text-sm text-rose-600 font-medium bg-rose-50 px-4 py-2 rounded-xl">{scheduleError}</p>}
                            <div className="flex gap-4 mt-8">
                                <button type="button" onClick={() => { setShowAddTopic(false); setEnableSchedule(false); setScheduleError(""); setScheduledAt(""); }} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
                                <button type="submit" disabled={isAddingTopic} className={`flex-1 py-3 font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 ${isAddingTopic ? "bg-indigo-400 cursor-not-allowed text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                                    {isAddingTopic ? <Spinner className="w-4 h-4" /> : enableSchedule ? <ICONS.Clock className="w-4 h-4" /> : null}
                                    {isAddingTopic ? "Adding..." : enableSchedule ? "Schedule Topic" : "Add to Queue"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
