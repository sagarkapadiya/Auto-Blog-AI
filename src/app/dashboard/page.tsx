"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { ICONS } from "@/lib/constants";
import { StatCardSkeleton, TableRowSkeleton, Spinner, FullPageLoader } from "@/components/Skeleton";
import { useToast } from "@/context/ToastContext";
import api from "@/lib/api";
import { read, utils } from "xlsx";

function computeMinDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5, 0, 0);
    return now.toISOString().slice(0, 16);
}

export default function DashboardPage() {
    const { token, user } = useAuth();
    const { toast } = useToast();
    const [stats, setStats] = useState({ totalTopics: 0, pendingReview: 0, publishedTotal: 0, todayGenerated: 0 });
    const [monthlyPublished, setMonthlyPublished] = useState(0);
    const [monthlyPublishLimit, setMonthlyPublishLimit] = useState(0);
    const [topics, setTopics] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [blogCount, setBlogCount] = useState(5);
    const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
    const [showAddTopic, setShowAddTopic] = useState(false);
    const [enableSchedule, setEnableSchedule] = useState(false);
    const [scheduleError, setScheduleError] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [minDateTime, setMinDateTime] = useState(computeMinDateTime);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [isAddingTopic, setIsAddingTopic] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

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
            const s = statsRes.data.stats || {};
            setMonthlyPublished(s.monthlyPublished ?? 0);
            setMonthlyPublishLimit(s.monthlyPublishLimit ?? 0);
            setTopics(topicsRes.data.topics || []);
            setSettings(settingsRes.data.settings || null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { if (token) refreshData(); }, [token, refreshData]);

    const handleOpenGenerateModal = () => {
        setBlogCount(5);
        setShowGenerateModal(true);
    };

    const handleBulkGenerate = async () => {
        setShowGenerateModal(false);
        setIsGeneratingBulk(true);
        setIsGenerating(true);
        try {
            const { data } = await api.post("/blogs/generate-bulk", { count: blogCount });
            const msg = data?.message || `${data?.generated || 0} blog(s) generated successfully.`;
            if (data?.failed > 0) {
                const details = data.failedDetails?.map((f: any) => `${f.title}: ${f.error}`).join("\n") || "";
                toast.error(`${msg} (${data.failed} failed)\n${details}`);
            } else {
                toast.success(msg);
            }
            refreshData();
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message || "Error generating blogs";
            toast.error(msg === "No pending topics found in queue" ? "No pending topics in queue. Add a topic first." : msg);
        } finally {
            setIsGeneratingBulk(false);
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

    const handleImportCSV = () => {
        setShowImportModal(true);
        setImportFile(null);
        setPreviewData([]);
        setValidationErrors([]);
    };

    const REQUIRED_COLUMNS = ['blog_title', 'category', 'target_audience', 'keywords', 'posted_by'];

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportFile(file);
        setValidationErrors([]);
        setPreviewData([]);

        try {
            const data = await file.arrayBuffer();
            const workbook = read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            if (jsonData.length < 2) {
                setValidationErrors(["File must contain a header row and at least one data row."]);
                return;
            }

            const headers = (jsonData[0] as string[]).map(h => typeof h === 'string' ? h.trim().toLowerCase() : '');

            const reqCols = [...REQUIRED_COLUMNS];
            const missingCols = reqCols.filter(col => !headers.includes(col));
            if (missingCols.length > 0) {
                if (missingCols.includes('posted_by') && missingCols.length === 1) {
                    if (headers.includes('posted by')) reqCols[reqCols.indexOf('posted_by')] = 'posted by';
                    else if (headers.includes('postedby')) reqCols[reqCols.indexOf('posted_by')] = 'postedby';
                    else {
                        setValidationErrors([`Missing required columns: posted_by`]);
                        return;
                    }
                } else {
                    setValidationErrors([`Missing required columns: ${missingCols.join(', ')}`]);
                    return;
                }
            }

            const colIndices = reqCols.reduce((acc, col) => {
                acc[col] = headers.indexOf(col);
                return acc;
            }, {} as Record<string, number>);

            const parsedData = [];
            const errors = [];

            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0 || row.every(cell => cell === undefined || cell === null || cell === '')) continue;

                const title = row[colIndices['blog_title']];
                const category = row[colIndices['category']];
                const targetAudience = row[colIndices['target_audience']];
                const keywordsRaw = row[colIndices['keywords']];
                const postedByCol = colIndices['posted_by'] ?? colIndices['posted by'] ?? colIndices['postedby'];
                const postedBy = postedByCol !== undefined ? row[postedByCol] : null;

                if (!title) errors.push(`Row ${i + 1}: blog_title is empty.`);
                if (!category) errors.push(`Row ${i + 1}: category is empty.`);

                parsedData.push({
                    title: title?.toString().trim() || "Untitled",
                    category: category?.toString().trim() || "Uncategorized",
                    targetAudience: targetAudience?.toString().trim() || "",
                    keywords: keywordsRaw ? keywordsRaw.toString().split(',').map((k: string) => k.trim()).filter(Boolean) : [],
                    postedBy: postedBy?.toString().trim() || "",
                });
            }

            if (errors.length > 0) {
                setValidationErrors(errors);
            } else if (parsedData.length === 0) {
                setValidationErrors(["No valid data rows found."]);
            } else {
                setPreviewData(parsedData);
            }

        } catch (err: any) {
            setValidationErrors([`Failed to read file: ${err.message}`]);
        }
    };

    const handleUploadBulk = async () => {
        if (previewData.length === 0) return;
        setIsImporting(true);
        try {
            await api.post("/topics/bulk", { topics: previewData });
            refreshData();
            toast.success(`Successfully imported ${previewData.length} topics!`);
            setShowImportModal(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Bulk import failed");
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Welcome Back, {user?.name || "Editor"}</h2>
                    <p className="text-slate-500 mt-1">Here&apos;s what&apos;s happening with your blog automation today.</p>
                </div>
                <button onClick={handleOpenGenerateModal} disabled={isGenerating} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all ${isGenerating ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"}`}>
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

            {/* Monthly publish limit banner */}
            {monthlyPublishLimit > 0 && (
                <div className={`flex items-center gap-4 p-4 rounded-2xl border ${monthlyPublished >= monthlyPublishLimit ? "bg-rose-50 border-rose-200" : "bg-indigo-50 border-indigo-200"}`}>
                    <ICONS.Lock className={`w-5 h-5 shrink-0 ${monthlyPublished >= monthlyPublishLimit ? "text-rose-500" : "text-indigo-500"}`} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-sm font-semibold ${monthlyPublished >= monthlyPublishLimit ? "text-rose-700" : "text-indigo-700"}`}>
                                {monthlyPublished >= monthlyPublishLimit
                                    ? "Monthly publish limit reached — contact your admin to increase it."
                                    : `Published this month: ${monthlyPublished} / ${monthlyPublishLimit}`}
                            </span>
                            <span className={`text-xs font-bold ${monthlyPublished >= monthlyPublishLimit ? "text-rose-500" : "text-indigo-500"}`}>
                                {monthlyPublishLimit - monthlyPublished > 0 ? `${monthlyPublishLimit - monthlyPublished} remaining` : "0 remaining"}
                            </span>
                        </div>
                        <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${monthlyPublished >= monthlyPublishLimit ? "bg-rose-500" : "bg-indigo-500"}`}
                                style={{ width: `${Math.min((monthlyPublished / monthlyPublishLimit) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

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

            {showGenerateModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                                <ICONS.Clock className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Generate Blogs</h3>
                                <p className="text-sm text-slate-500">Run blog generation task now</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-2">How many blogs do you want to generate now?</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={blogCount}
                                    onChange={(e) => setBlogCount(Math.min(Math.max(Number(e.target.value) || 1, 1), 10))}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-lg font-semibold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <p className="text-xs text-slate-400 mt-1.5 text-center">Enter a number between 1 and 10</p>
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowGenerateModal(false)}
                                    className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBulkGenerate}
                                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <ICONS.Clock className="w-4 h-4" />
                                    Generate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isGeneratingBulk && (
                <FullPageLoader message={`Generating ${blogCount} blog${blogCount !== 1 ? "s" : ""}... This may take a while.`} />
            )}

            {showImportModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl rounded-3xl p-8 shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold">Import CSV / Excel</h3>
                            <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                                <ICONS.X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-slate-600 mb-2">Upload File (.csv, .xlsx, .xls)</label>
                            <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileSelect} className="w-full px-4 py-3 border border-slate-200 rounded-2xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                            <p className="text-xs text-slate-500 mt-2">Required columns: blog_title, category, target_audience, keywords, posted_by</p>
                        </div>

                        {validationErrors.length > 0 && (
                            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl overflow-y-auto max-h-40">
                                <h4 className="text-sm font-bold text-rose-700 mb-2">Validation Errors:</h4>
                                <ul className="list-disc list-inside text-sm text-rose-600 space-y-1">
                                    {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </div>
                        )}

                        {previewData.length > 0 && (
                            <div className="flex-1 overflow-auto border border-slate-200 rounded-2xl mb-6 min-h-[200px]">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-bold tracking-wider sticky top-0 shadow-sm border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-3">Title</th>
                                            <th className="px-4 py-3">Category</th>
                                            <th className="px-4 py-3">Audience</th>
                                            <th className="px-4 py-3">Keywords</th>
                                            <th className="px-4 py-3">Posted By</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {previewData.slice(0, 50).map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-800">{row.title}</td>
                                                <td className="px-4 py-3 text-slate-600">{row.category}</td>
                                                <td className="px-4 py-3 text-slate-600">{row.targetAudience}</td>
                                                <td className="px-4 py-3 text-slate-600">{row.keywords.join(", ")}</td>
                                                <td className="px-4 py-3 text-slate-600">{row.postedBy}</td>
                                            </tr>
                                        ))}
                                        {previewData.length > 50 && (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-3 text-center text-slate-500 bg-slate-50 font-medium">+ {previewData.length - 50} more rows</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex gap-4 mt-auto pt-4 border-t border-slate-100">
                            <button type="button" onClick={() => setShowImportModal(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50">Cancel</button>
                            <button type="button" onClick={handleUploadBulk} disabled={isImporting || previewData.length === 0} className={`flex-1 py-3 font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${isImporting || previewData.length === 0 ? "bg-indigo-300 text-white cursor-not-allowed shadow-none" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"}`}>
                                {isImporting ? <Spinner className="w-4 h-4" /> : <ICONS.Upload className="w-4 h-4" />}
                                {isImporting ? "Uploading..." : `Upload ${previewData.length} Topics`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
