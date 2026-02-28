"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import BlogEditor from "@/components/BlogEditor";
import { PublishedRowSkeleton, FullPageLoader } from "@/components/Skeleton";
import { useToast } from "@/context/ToastContext";
import api from "@/lib/api";

export default function PublishedPage() {
    const { token } = useAuth();
    const { toast } = useToast();
    const [blogs, setBlogs] = useState<any[]>([]);
    const [editingBlog, setEditingBlog] = useState<any>(null);
    const [deletingBlogId, setDeletingBlogId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const refreshData = useCallback(async () => {
        try {
            const { data } = await api.get("/blogs");
            setBlogs(data.blogs || []);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { if (token) refreshData(); }, [token, refreshData]);

    const publishedBlogs = blogs.filter((b: any) => b.status === "PUBLISHED");

    const handleUpdatePublished = async (blog: any) => {
        setIsSaving(true);
        try {
            await api.put(`/blogs/${blog._id}`, blog);
            setEditingBlog(null);
            toast.success("Blog updated successfully!");
            refreshData();
        } catch (error: any) {
            toast.error("Error saving: " + (error.response?.data?.error || error.message));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBlog = async (blogId: string) => {
        if (!confirm("Are you sure you want to delete this published blog? This will also remove it from the external platform if a delete API is configured.")) return;
        setDeletingBlogId(blogId);
        try {
            await api.delete(`/blogs/${blogId}`);
            toast.success("Blog deleted successfully!");
            refreshData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to delete blog");
        } finally {
            setDeletingBlogId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">Published Blogs</h2>
                <p className="text-slate-500">History of your automatically published content.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <PublishedRowSkeleton key={i} />)
                ) : publishedBlogs.length === 0 ? (
                    <div className="p-20 text-center text-slate-400">No blogs published yet.</div>
                ) : publishedBlogs.map((blog: any) => (
                    <div key={blog._id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
                        <div className="flex items-center gap-6">
                            {blog.featuredImageUrl && (
                                <img src={blog.featuredImageUrl} className="w-20 h-20 rounded-xl object-cover border border-slate-200" alt="Thumb" />
                            )}
                            <div>
                                <h4 className="font-bold text-slate-800 text-lg">{blog.seoTitle}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs font-semibold text-slate-400">Slug: /{blog.slug}</span>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                    <span className="text-xs font-semibold text-slate-400">Published: {blog.publishedAt ? new Date(blog.publishedAt).toLocaleDateString() : "N/A"}</span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {blog.tags?.map((tag: string) => (
                                        <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-semibold">#{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingBlog(blog)} className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors">Edit</button>
                            <button onClick={() => handleDeleteBlog(blog._id)} disabled={deletingBlogId === blog._id} className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${deletingBlogId === blog._id ? "text-slate-400 border border-slate-200 cursor-not-allowed" : "text-rose-600 border border-rose-200 hover:bg-rose-50"}`}>
                                {deletingBlogId === blog._id && <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />}
                                {deletingBlogId === blog._id ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {isSaving && <FullPageLoader message="Saving blog changes..." />}

            {editingBlog && (
                <BlogEditor blog={editingBlog} onApprove={handleUpdatePublished} onReject={() => setEditingBlog(null)} onClose={() => setEditingBlog(null)} isPublishing={isSaving} />
            )}
        </div>
    );
}
