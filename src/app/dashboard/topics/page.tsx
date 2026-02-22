"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { ICONS } from "@/lib/constants";
import { TableRowSkeleton, Spinner } from "@/components/Skeleton";
import { useToast } from "@/context/ToastContext";
import api from "@/lib/api";

function computeMinDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5, 0, 0);
    return now.toISOString().slice(0, 16);
}

export default function TopicsPage() {
    const { token } = useAuth();
    const { toast } = useToast();
    const [topics, setTopics] = useState<any[]>([]);
    const [showAddTopic, setShowAddTopic] = useState(false);
    const [enableSchedule, setEnableSchedule] = useState(false);
    const [scheduleError, setScheduleError] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [minDateTime, setMinDateTime] = useState(computeMinDateTime);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [isAddingTopic, setIsAddingTopic] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [retryingId, setRetryingId] = useState<string | null>(null);

    useEffect(() => {
        if (!enableSchedule) return;
        const timer = setInterval(() => setMinDateTime(computeMinDateTime()), 30_000);
        setMinDateTime(computeMinDateTime());
        return () => clearInterval(timer);
    }, [enableSchedule]);

    const refreshData = useCallback(async () => {
        try {
            const { data } = await api.get("/topics");
            setTopics(data.topics || []);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { if (token) refreshData(); }, [token, refreshData]);

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
                title: formData.get("title"),
                category: formData.get("category"),
                keywords: (formData.get("keywords") as string).split(",").map(k => k.trim()),
                targetAudience: formData.get("audience"),
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

    const handleDeleteTopic = async (topicId: string) => {
        if (!confirm("Are you sure you want to delete this topic?")) return;
        setDeletingId(topicId);
        try {
            await api.delete(`/topics/${topicId}`);
            toast.success("Topic deleted successfully!");
            refreshData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to delete topic");
        } finally {
            setDeletingId(null);
        }
    };

    const handleRetryTopic = async (topicId: string) => {
        setRetryingId(topicId);
        try {
            // Reset cronStatus to SCHEDULED so the cron will pick it up again
            await api.patch(`/topics/${topicId}`, { cronStatus: "SCHEDULED" });
            // Trigger the cron immediately for this user
            await api.post("/cron/generate", {});
            toast.success("Retrying blog generation...");
            setTimeout(refreshData, 3000);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Retry failed");
        } finally {
            setRetryingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Topic Management</h2>
                    <p className="text-slate-500">Add or import blog topics for the AI generator.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleImportCSV} disabled={isImporting} className={`flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl font-semibold transition-all ${isImporting ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white hover:bg-slate-50"}`}>
                        {isImporting ? <Spinner className="w-5 h-5" /> : <ICONS.Upload className="w-5 h-5" />}
                        {isImporting ? "Importing..." : "Import CSV"}
                    </button>
                    <button onClick={() => setShowAddTopic(true)} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                        <ICONS.Plus className="w-5 h-5" /> New Topic
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-5">Topic</th>
                            <th className="px-6 py-5">Category</th>
                            <th className="px-6 py-5">Audience</th>
                            <th className="px-6 py-5">Scheduled</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                        ) : topics.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-14 text-center text-slate-400">No topics added yet.</td></tr>
                        ) : topics.map((topic: any) => (
                            <tr key={topic._id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-5">
                                    <div className="font-semibold text-slate-800">{topic.title}</div>
                                    <div className="text-xs text-slate-400 mt-1">Keywords: {topic.keywords?.join(", ")}</div>
                                </td>
                                <td className="px-6 py-5 text-slate-600 font-medium">{topic.category}</td>
                                <td className="px-6 py-5 text-slate-500">{topic.targetAudience}</td>
                                <td className="px-6 py-5">
                                    {topic.scheduledAt ? (
                                        <div className="flex items-center gap-1.5">
                                            <ICONS.Clock className="w-3.5 h-3.5 text-indigo-500" />
                                            <div>
                                                <div className="text-xs font-semibold text-slate-700">{new Date(topic.scheduledAt).toLocaleDateString()}</div>
                                                <div className="text-[10px] text-slate-400">{new Date(topic.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                            {topic.cronStatus === "DONE" && <ICONS.Check className="w-3.5 h-3.5 text-emerald-500 ml-1" />}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400">—</span>
                                    )}
                                </td>
                                <td className="px-6 py-5">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${topic.cronStatus === "FAILED" ? "bg-rose-100 text-rose-700" :
                                            topic.status === "PENDING" && topic.cronStatus === "SCHEDULED" ? "bg-indigo-100 text-indigo-700" :
                                                topic.status === "PENDING" ? "bg-blue-100 text-blue-700" :
                                                    topic.status === "GENERATED" ? "bg-amber-100 text-amber-700" :
                                                        "bg-emerald-100 text-emerald-700"
                                        }`}>
                                        {topic.cronStatus === "FAILED" ? "FAILED" : topic.status === "PENDING" && topic.cronStatus === "SCHEDULED" ? "SCHEDULED" : topic.status}
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {topic.cronStatus === "FAILED" && (
                                            <button
                                                onClick={() => handleRetryTopic(topic._id)}
                                                disabled={retryingId === topic._id}
                                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${retryingId === topic._id
                                                        ? "border border-slate-200 text-slate-400 cursor-not-allowed"
                                                        : "text-indigo-600 border border-indigo-200 hover:bg-indigo-50"
                                                    }`}
                                            >
                                                {retryingId === topic._id ? <Spinner className="w-3.5 h-3.5" /> : <ICONS.Clock className="w-3.5 h-3.5" />}
                                                {retryingId === topic._id ? "Retrying..." : "Retry"}
                                            </button>
                                        )}
                                        <button onClick={() => handleDeleteTopic(topic._id)} disabled={deletingId === topic._id} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${deletingId === topic._id ? "border border-slate-200 text-slate-400 cursor-not-allowed" : "text-rose-600 border border-rose-200 hover:bg-rose-50"}`}>
                                            {deletingId === topic._id ? <Spinner className="w-3.5 h-3.5" /> : <ICONS.X className="w-3.5 h-3.5" />}
                                            {deletingId === topic._id ? "Deleting..." : "Delete"}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
                                <button type="button" onClick={() => { setShowAddTopic(false); setEnableSchedule(false); setScheduleError(""); setScheduledAt(""); }} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50">Cancel</button>
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
