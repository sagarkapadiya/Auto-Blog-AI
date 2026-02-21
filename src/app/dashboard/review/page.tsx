"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { ICONS } from "@/lib/constants";
import BlogEditor from "@/components/BlogEditor";
import { BlogCardSkeleton, FullPageLoader } from "@/components/Skeleton";
import { useToast } from "@/context/ToastContext";
import api from "@/lib/api";

export default function ReviewPage() {
    const { token } = useAuth();
    const { toast } = useToast();
    const [blogs, setBlogs] = useState<any[]>([]);
    const [selectedBlog, setSelectedBlog] = useState<any>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const refreshData = useCallback(async () => {
        try {
            const { data } = await api.get("/blogs");
            setBlogs(data.blogs || []);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { if (token) refreshData(); }, [token, refreshData]);

    const reviewBlogs = blogs.filter((b: any) => b.status === "GENERATED" || b.status === "REJECTED");

    const handleApprove = async (blog: any) => {
        setIsPublishing(true);
        try {
            await api.put(`/blogs/${blog._id}`, { ...blog, status: "PUBLISHED", publishedAt: new Date().toISOString() });
            setSelectedBlog(null);
            toast.success("Blog published successfully!");
            refreshData();
        } catch (error: any) {
            toast.error("Error publishing: " + (error.response?.data?.error || error.message));
        } finally {
            setIsPublishing(false);
        }
    };

    const handleReject = async (id: string, reason: string) => {
        setIsRejecting(true);
        try {
            await api.put(`/blogs/${id}`, { status: "REJECTED", comments: reason });
            setSelectedBlog(null);
            toast.info("Blog rejected and sent back for revision");
            refreshData();
        } catch (error: any) {
            toast.error("Error rejecting: " + (error.response?.data?.error || error.message));
        } finally {
            setIsRejecting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">Review Queue</h2>
                <p className="text-slate-500">Approve or edit AI-generated blogs before they go live.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <BlogCardSkeleton key={i} />)
                ) : reviewBlogs.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                        <ICONS.Review className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-medium">Nothing in the review queue.</p>
                    </div>
                ) : reviewBlogs.map((blog: any) => (
                    <div key={blog._id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col hover:shadow-xl hover:shadow-slate-100 transition-all">
                        <div className="relative h-48">
                            {blog.featuredImageUrl && <img src={blog.featuredImageUrl} className="w-full h-full object-cover" alt="Featured" />}
                            <div className="absolute top-4 left-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${blog.status === "REJECTED" ? "bg-rose-600 text-white" : "bg-indigo-600 text-white"}`}>{blog.status}</span>
                            </div>
                        </div>
                        <div className="p-6 flex-1">
                            <h3 className="font-bold text-lg text-slate-800 line-clamp-2 leading-tight">{blog.seoTitle}</h3>
                            <p className="text-slate-500 text-sm mt-3 line-clamp-3">{blog.metaDescription}</p>
                            {blog.comments && (
                                <div className="mt-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-100">
                                    <strong>Rejection Note:</strong> {blog.comments}
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button onClick={() => setSelectedBlog(blog)} className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors">Review Content</button>
                        </div>
                    </div>
                ))}
            </div>

            {isPublishing && <FullPageLoader message="Publishing blog to third-party API..." />}

            {selectedBlog && (
                <BlogEditor blog={selectedBlog} onApprove={handleApprove} onReject={handleReject} onClose={() => setSelectedBlog(null)} isPublishing={isPublishing} isRejecting={isRejecting} />
            )}
        </div>
    );
}
