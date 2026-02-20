
import React, { useState } from 'react';
import { BlogContent, BlogStatus } from '../types';
import { ICONS } from '../constants';

interface BlogEditorProps {
  blog: BlogContent;
  onApprove: (blog: BlogContent) => void;
  onReject: (id: string, reason: string) => void;
  onClose: () => void;
}

const BlogEditor: React.FC<BlogEditorProps> = ({ blog, onApprove, onReject, onClose }) => {
  const [content, setContent] = useState(blog.content);
  const [title, setTitle] = useState(blog.seoTitle);
  const [slug, setSlug] = useState(blog.slug);
  const [metaDescription, setMetaDescription] = useState(blog.metaDescription);
  const [tags, setTags] = useState(blog.tags.join(', '));
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end">
      <div className="w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Review Blog Content</h2>
            <p className="text-sm text-slate-500">Topic ID: {blog.topicId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
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
                className="w-full text-2xl font-bold text-slate-800 border-none p-0 focus:ring-0"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-100 border-b border-slate-200 flex gap-2">
                <span className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-500">Visual</span>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold border border-indigo-200">HTML Editor</span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-[500px] p-6 text-slate-700 font-mono text-sm border-none focus:ring-0 resize-none"
              />
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <label className="block text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <label className="block text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Tags (comma separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {tags.split(',')?.map(tag => tag?.trim()).filter(Boolean).map(tag => (
                    <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">#{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <label className="block text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Featured Image Preview</label>
              <img src={blog.featuredImageUrl} className="w-full h-64 object-cover rounded-xl" alt="Featured" />
              <p className="mt-4 text-xs text-slate-400 italic">Prompt: {blog.featuredImagePrompt}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-200 flex items-center justify-between">
          <button 
            onClick={() => setShowRejectModal(true)}
            className="px-6 py-2 border border-rose-200 text-rose-600 font-semibold rounded-xl hover:bg-rose-50 transition-colors"
          >
            Reject Changes
          </button>
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="px-6 py-2 text-slate-500 font-semibold hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => onApprove({
                ...blog,
                content,
                seoTitle: title,
                slug,
                metaDescription,
                tags: tags.split(',')?.map(t => t?.trim()).filter(Boolean) || [],
                status: BlogStatus.APPROVED,
              })}
              className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <ICONS.Check className="w-5 h-5" />
              Approve & Publish
            </button>
          </div>
        </div>

        {showRejectModal && (
          <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
              <h3 className="text-xl font-bold mb-4">Reject Blog</h3>
              <textarea 
                placeholder="Why are you rejecting this blog? (Comments for refinement)"
                className="w-full h-32 p-4 border border-slate-200 rounded-xl mb-6 focus:ring-2 focus:ring-indigo-500"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-4">
                <button onClick={() => setShowRejectModal(false)} className="flex-1 py-2 border border-slate-200 rounded-xl">Cancel</button>
                <button 
                  onClick={() => onReject(blog.id, rejectReason)}
                  className="flex-1 py-2 bg-rose-600 text-white font-bold rounded-xl"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogEditor;
