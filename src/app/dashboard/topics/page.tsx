"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { ICONS } from "@/lib/constants";
import { TableRowSkeleton, Spinner } from "@/components/Skeleton";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";
import api from "@/lib/api";
import { read, utils } from "xlsx";

function computeMinDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5, 0, 0);
    return now.toISOString().slice(0, 16);
}

export default function TopicsPage() {
    const { token } = useAuth();
    const { toast } = useToast();
    const confirm = useConfirm();
    const [topics, setTopics] = useState<any[]>([]);
    const [showAddTopic, setShowAddTopic] = useState(false);
    const [enableSchedule, setEnableSchedule] = useState(false);
    const [scheduleError, setScheduleError] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [minDateTime, setMinDateTime] = useState(computeMinDateTime);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [isAddingTopic, setIsAddingTopic] = useState(false);
    const [editingTopic, setEditingTopic] = useState<any>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [retryingId, setRetryingId] = useState<string | null>(null);

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
        minAllowed.setMinutes(minAllowed.getMinutes() + 1, 0, 0);
        if (selected < minAllowed) return "Scheduled time must be at least 1 minute from now";
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
        const payload = {
            title: formData.get("title"),
            category: formData.get("category"),
            keywords: (formData.get("keywords") as string).split(",").map(k => k.trim()),
            targetAudience: formData.get("audience"),
            postedBy: formData.get("postedBy"),
            scheduledAt: enableSchedule && scheduledAt ? scheduledAt : null,
        };
        try {
            if (editingTopic) {
                await api.patch(`/topics/${editingTopic._id}`, payload);
                toast.success("Topic updated successfully!");
            } else {
                await api.post("/topics", payload);
                toast.success(enableSchedule ? "Topic scheduled successfully!" : "Topic added to queue!");
            }
            setShowAddTopic(false);
            setEditingTopic(null);
            setEnableSchedule(false);
            setScheduleError("");
            setScheduledAt("");
            refreshData();
        } catch (error: any) {
            setScheduleError(error.response?.data?.error || (editingTopic ? "Failed to update topic" : "Failed to create topic"));
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

            const missingCols = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
            if (missingCols.length > 0) {
                // If 'posted_by' is missing, try 'posted by' or 'postedBy' or fallback
                if (missingCols.includes('posted_by') && missingCols.length === 1) {
                    if (headers.includes('posted by')) REQUIRED_COLUMNS[REQUIRED_COLUMNS.indexOf('posted_by')] = 'posted by';
                    else if (headers.includes('postedby')) REQUIRED_COLUMNS[REQUIRED_COLUMNS.indexOf('posted_by')] = 'postedby';
                    else {
                        setValidationErrors([`Missing required columns: posted_by`]);
                        return;
                    }
                } else {
                    setValidationErrors([`Missing required columns: ${missingCols.join(', ')}`]);
                    return;
                }
            }

            const colIndices = REQUIRED_COLUMNS.reduce((acc, col) => {
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
                let postedBy = row[colIndices['posted_by']] || null;
                if (!postedBy && colIndices['posted by'] !== undefined) postedBy = row[colIndices['posted by']];
                if (!postedBy && colIndices['postedby'] !== undefined) postedBy = row[colIndices['postedby']];

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

    const handleDeleteTopic = async (topicId: string) => {
        const confirmed = await confirm({
            title: "Delete Topic",
            message: "Are you sure you want to delete this topic?",
            confirmText: "Delete",
            variant: "danger",
        });
        if (!confirmed) return;
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
                    <button onClick={() => { setEditingTopic(null); setEnableSchedule(false); setScheduledAt(""); setShowAddTopic(true); }} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
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
                            <th className="px-6 py-5">Keywords</th>
                            <th className="px-6 py-5">Posted By</th>
                            <th className="px-6 py-5">Scheduled</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                        ) : topics.length === 0 ? (
                            <tr><td colSpan={8} className="px-6 py-14 text-center text-slate-400">No topics added yet.</td></tr>
                        ) : topics.map((topic: any) => (
                            <tr key={topic._id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-5">
                                    <div className="font-semibold text-slate-800">{topic.title}</div>
                                </td>
                                <td className="px-6 py-5 text-slate-600 font-medium">{topic.category}</td>
                                <td className="px-6 py-5 text-slate-500">{topic.targetAudience}</td>
                                <td className="px-6 py-5 text-slate-500 text-xs">{(topic.keywords || []).join(", ")}</td>
                                <td className="px-6 py-5 text-slate-500">{topic.postedBy || <span className="text-slate-300">—</span>}</td>
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
                                        {topic.status === "PENDING" && (
                                            <button onClick={() => { setEditingTopic(topic); setEnableSchedule(!!topic.scheduledAt); if (topic.scheduledAt) setScheduledAt(new Date(topic.scheduledAt).toISOString().slice(0, 16)); else setScheduledAt(""); setShowAddTopic(true); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 text-slate-600 border border-slate-200 hover:bg-slate-50">
                                                <ICONS.Edit className="w-3.5 h-3.5" />
                                                Edit
                                            </button>
                                        )}
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
                        <h3 className="text-2xl font-bold mb-6">{editingTopic ? "Edit Topic" : "Add New Topic"}</h3>
                        <form onSubmit={handleAddTopic} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Topic Title</label>
                                <input name="title" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="e.g. The Impact of Quantum Computing" defaultValue={editingTopic?.title || ""} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Category</label>
                                    <input name="category" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="Tech" defaultValue={editingTopic?.category || ""} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Target Audience</label>
                                    <input name="audience" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="Professionals" defaultValue={editingTopic?.targetAudience || ""} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Keywords (Comma separated)</label>
                                    <input name="keywords" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="crypto, safety, tech 2024" defaultValue={editingTopic?.keywords?.join(", ") || ""} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Posted By</label>
                                    <input name="postedBy" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="Author Name" defaultValue={editingTopic?.postedBy || ""} />
                                </div>
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
                                            <ICONS.Clock className="w-3 h-3" /> {scheduleError || "Must be at least 1 minute from now"}
                                        </p>
                                    </div>
                                )}
                            </div>
                            {scheduleError && <p className="text-sm text-rose-600 font-medium bg-rose-50 px-4 py-2 rounded-xl">{scheduleError}</p>}
                            <div className="flex gap-4 mt-8">
                                <button type="button" onClick={() => { setShowAddTopic(false); setEditingTopic(null); setEnableSchedule(false); setScheduleError(""); setScheduledAt(""); }} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={isAddingTopic} className={`flex-1 py-3 font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 ${isAddingTopic ? "bg-indigo-400 cursor-not-allowed text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                                    {isAddingTopic ? <Spinner className="w-4 h-4" /> : enableSchedule ? <ICONS.Clock className="w-4 h-4" /> : null}
                                    {isAddingTopic ? (editingTopic ? "Updating..." : "Adding...") : editingTopic ? "Update Topic" : enableSchedule ? "Schedule Topic" : "Add to Queue"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
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
