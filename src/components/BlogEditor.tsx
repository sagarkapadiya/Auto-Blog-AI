"use client";

import { useState } from "react";
import { ICONS } from "@/lib/constants";
import { Spinner } from "@/components/Skeleton";

interface BlogEditorProps {
    blog: any;
    onApprove: (blog: any) => void;
    onSchedule?: (blog: any, scheduledAt: string) => void;
    onReject: (id: string, reason: string) => void;
    onClose: () => void;
    isPublishing?: boolean;
    isRejecting?: boolean;
}

export default function BlogEditor({ blog, onApprove, onSchedule, onReject, onClose, isPublishing = false, isRejecting = false }: BlogEditorProps) {
    const [content, setContent] = useState(blog.content);
    const [title, setTitle] = useState(blog.seoTitle);
    const [slug, setSlug] = useState(blog.slug);
    const [metaDescription, setMetaDescription] = useState(blog.metaDescription);
    const [tags, setTags] = useState(blog.tags?.join(", ") || "");
    const [rejectReason, setRejectReason] = useState("");
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [scheduledDate, setScheduledDate] = useState("");
    const [scheduledTime, setScheduledTime] = useState("");
    const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

    const isBusy = isPublishing || isRejecting;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end">
            <div className="w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Review Blog Content</h2>
                        <p className="text-sm text-slate-500">Topic ID: {blog.topicId}</p>
                    </div>
                    <button onClick={onClose} disabled={isBusy} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-50">
                        <ICONS.X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <label className="block text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">SEO Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={isBusy}
                                className="w-full text-2xl font-bold text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent disabled:opacity-60"
                            />
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-100 border-b border-slate-200 flex gap-2">
                                <button
                                    onClick={() => setActiveTab("editor")}
                                    className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                                        activeTab === "editor"
                                            ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                    }`}
                                >
                                    HTML Editor
                                </button>
                                <button
                                    onClick={() => setActiveTab("preview")}
                                    className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                                        activeTab === "preview"
                                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                    }`}
                                >
                                    Preview
                                </button>
                            </div>
                            {activeTab === "editor" ? (
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    disabled={isBusy}
                                    className="w-full h-[500px] p-6 text-slate-700 font-mono text-sm border-none focus:ring-0 resize-none outline-none disabled:opacity-60"
                                />
                            ) : (
                                <div
                                    className="w-full h-[500px] p-6 overflow-y-auto prose prose-slate max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-a:text-indigo-600 prose-li:text-slate-600 prose-strong:text-slate-800"
                                    dangerouslySetInnerHTML={{ __html: content }}
                                />
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <label className="block text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Slug</label>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">/</span>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    disabled={isBusy}
                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <label className="block text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Meta Description</label>
                                <textarea
                                    value={metaDescription}
                                    onChange={(e) => setMetaDescription(e.target.value)}
                                    rows={3}
                                    disabled={isBusy}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none disabled:opacity-60"
                                />
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <label className="block text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Tags (comma separated)</label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    disabled={isBusy}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60"
                                />
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {tags.split(",").map((tag: string) => tag.trim()).filter(Boolean).map((tag: string) => (
                                        <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">#{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {blog.featuredImageUrl && (
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <label className="block text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Featured Image Preview</label>
                                <img src={blog.featuredImageUrl} className="w-full h-64 object-cover rounded-xl" alt="Featured" />
                                <p className="mt-4 text-xs text-slate-400 italic">Prompt: {blog.featuredImagePrompt}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 bg-white border-t border-slate-200 flex items-center justify-between">
                    <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={isBusy}
                        className="px-6 py-2 border border-rose-200 text-rose-600 font-semibold rounded-xl hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Reject Changes
                    </button>
                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            disabled={isBusy}
                            className="px-6 py-2 text-slate-500 font-semibold hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (onSchedule) {
                                    setShowPublishModal(true);
                                } else {
                                    onApprove({
                                        ...blog,
                                        content,
                                        seoTitle: title,
                                        slug,
                                        metaDescription,
                                        tags: tags.split(",").map((t: string) => t.trim()).filter(Boolean),
                                        status: "APPROVED",
                                    });
                                }
                            }}
                            disabled={isBusy}
                            className={`px-8 py-2 font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 ${
                                isPublishing
                                    ? "bg-indigo-400 text-white cursor-not-allowed"
                                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                            }`}
                        >
                            {isPublishing ? (
                                <>
                                    <Spinner className="w-5 h-5" />
                                    {onSchedule ? "Publishing..." : "Saving..."}
                                </>
                            ) : (
                                <>
                                    <ICONS.Check className="w-5 h-5" />
                                    {onSchedule ? "Approve & Publish" : "Save Changes"}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {showRejectModal && (
                    <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
                            <h3 className="text-xl font-bold mb-4">Reject Blog</h3>
                            <textarea
                                placeholder="Why are you rejecting this blog? (Comments for refinement)"
                                className="w-full h-32 p-4 border border-slate-200 rounded-xl mb-6 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                disabled={isRejecting}
                            />
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowRejectModal(false)}
                                    disabled={isRejecting}
                                    className="flex-1 py-2 border border-slate-200 rounded-xl font-medium disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => onReject(blog._id, rejectReason)}
                                    disabled={isRejecting}
                                    className={`flex-1 py-2 font-bold rounded-xl flex items-center justify-center gap-2 ${
                                        isRejecting ? "bg-rose-400 text-white cursor-not-allowed" : "bg-rose-600 text-white"
                                    }`}
                                >
                                    {isRejecting ? <><Spinner className="w-4 h-4" /> Rejecting...</> : "Confirm Reject"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showPublishModal && (
                    <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Publish Blog</h3>
                            <p className="text-sm text-slate-500 mb-6">Would you like to publish this blog now or schedule it for later?</p>

                            <div className="space-y-4">
                                {/* Schedule section */}
                                <div className="p-4 border border-slate-200 rounded-xl space-y-3">
                                    <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Schedule for later</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Date</label>
                                            <input
                                                type="date"
                                                value={scheduledDate}
                                                onChange={(e) => setScheduledDate(e.target.value)}
                                                min={new Date().toISOString().split("T")[0]}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Time</label>
                                            <input
                                                type="time"
                                                value={scheduledTime}
                                                onChange={(e) => setScheduledTime(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!scheduledDate || !scheduledTime || !onSchedule) return;
                                            const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
                                            onSchedule(
                                                {
                                                    ...blog,
                                                    content,
                                                    seoTitle: title,
                                                    slug,
                                                    metaDescription,
                                                    tags: tags.split(",").map((t: string) => t.trim()).filter(Boolean),
                                                },
                                                scheduledAt
                                            );
                                            setShowPublishModal(false);
                                        }}
                                        disabled={!scheduledDate || !scheduledTime || isBusy}
                                        className="w-full py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                        </svg>
                                        Schedule Publish
                                    </button>
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                                    <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400 uppercase">or</span></div>
                                </div>

                                {/* Publish now */}
                                <button
                                    onClick={() => {
                                        onApprove({
                                            ...blog,
                                            content,
                                            seoTitle: title,
                                            slug,
                                            metaDescription,
                                            tags: tags.split(",").map((t: string) => t.trim()).filter(Boolean),
                                            status: "APPROVED",
                                        });
                                        setShowPublishModal(false);
                                    }}
                                    disabled={isBusy}
                                    className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <ICONS.Check className="w-5 h-5" />
                                    Publish Now
                                </button>

                                <button
                                    onClick={() => setShowPublishModal(false)}
                                    disabled={isBusy}
                                    className="w-full py-2 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
