
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import BlogEditor from './components/BlogEditor';
import { MockDatabase } from './services/mockDatabase';
import { SarvamService } from './services/sarvamService';
import { BlogApiService } from './services/blogApiService';
import { parseCurlCommand } from './services/curlParser';
import { Topic, BlogContent, BlogStatus, Settings, DashboardStats } from './types';
import { ICONS } from './constants';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [blogs, setBlogs] = useState<BlogContent[]>([]);
  const [settings, setSettings] = useState<Settings>(MockDatabase.getSettings());
  const [stats, setStats] = useState<DashboardStats>(MockDatabase.getStats());
  const [selectedBlog, setSelectedBlog] = useState<BlogContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [editingPublishedBlog, setEditingPublishedBlog] = useState<BlogContent | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [deletingBlogId, setDeletingBlogId] = useState<string | null>(null);

  // Load Initial Data
  useEffect(() => {
    setTopics(MockDatabase.getTopics());
    setBlogs(MockDatabase.getBlogs());
    setStats(MockDatabase.getStats());
  }, []);

  const refreshData = useCallback(() => {
    setTopics(MockDatabase.getTopics());
    setBlogs(MockDatabase.getBlogs());
    setStats(MockDatabase.getStats());
  }, []);

  // Handlers
  const handleAddTopic = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    MockDatabase.addTopic({
      title: formData.get('title') as string,
      category: formData.get('category') as string,
      keywords: (formData.get('keywords') as string).split(',')?.map(k => k?.trim()),
      targetAudience: formData.get('audience') as string,
    });
    setShowAddTopic(false);
    refreshData();
  };

  const handleRunScheduler = async () => {
    if (!settings.api_key) {
      alert("Please add an API Key in Settings first!");
      setActiveTab('settings');
      return;
    }

    const pendingTopic = topics.find(t => t.status === BlogStatus.PENDING);
    if (!pendingTopic) {
      alert("No pending topics found in queue.");
      return;
    }

    setIsGenerating(true);
    const sarvam = new SarvamService(settings.api_key);

    try {
      const generated = await sarvam.generateBlog(pendingTopic);

      MockDatabase.addBlog({
        ...generated as BlogContent,
      });
      
      refreshData();
    } catch (error) {
      console.error(error);
      alert("Error generating blog. Check API Key and console.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async (blog: BlogContent) => {
    if (!settings.curlCommand?.trim()) {
      alert('Please add a cURL command in Settings before publishing.');
      setActiveTab('settings');
      return;
    }

    setIsPublishing(true);
    try {
      const topic = topics.find(t => t.id === blog.topicId);
      const blogData: Record<string, unknown> = {
        title: blog.seoTitle,
        slug: blog.slug,
        excerpt: blog.metaDescription,
        content: blog.content,
        author: settings.reviewerEmail || 'Admin',
        category: topic?.category || 'General',
        tags: blog.tags,
        metaDescription: blog.metaDescription,
        featuredImageUrl: blog.featuredImageUrl,
        featuredImagePrompt: blog.featuredImagePrompt,
        isPublished: true,
      };

      await BlogApiService.postBlog(settings.curlCommand, blogData);

      MockDatabase.updateBlog(blog.id, {
        status: BlogStatus.PUBLISHED,
        publishedAt: Date.now(),
        seoTitle: blog.seoTitle,
        slug: blog.slug,
        metaDescription: blog.metaDescription,
        content: blog.content,
        tags: blog.tags,
      });
      setSelectedBlog(null);
      refreshData();
    } catch (error) {
      console.error('Error publishing to remote API', error);
      alert(`Error publishing: ${error instanceof Error ? error.message : 'Unknown error'}. Saved locally instead.`);
      MockDatabase.updateBlog(blog.id, { status: BlogStatus.PUBLISHED, publishedAt: Date.now() });
      setSelectedBlog(null);
      refreshData();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUpdatePublished = async (blog: BlogContent) => {
    if (!settings.curlCommand?.trim()) {
      alert('Please add a cURL command in Settings before updating.');
      setActiveTab('settings');
      return;
    }

    setIsPublishing(true);
    try {
      const topic = topics.find(t => t.id === blog.topicId);
      const blogData: Record<string, unknown> = {
        title: blog.seoTitle,
        slug: blog.slug,
        excerpt: blog.metaDescription,
        content: blog.content,
        author: settings.reviewerEmail || 'Admin',
        category: topic?.category || 'General',
        tags: blog.tags,
        metaDescription: blog.metaDescription,
        featuredImageUrl: blog.featuredImageUrl,
        featuredImagePrompt: blog.featuredImagePrompt,
        isPublished: true,
      };

      await BlogApiService.postBlog(settings.curlCommand, blogData);

      MockDatabase.updateBlog(blog.id, {
        seoTitle: blog.seoTitle,
        slug: blog.slug,
        metaDescription: blog.metaDescription,
        content: blog.content,
        tags: blog.tags,
      });
      setEditingPublishedBlog(null);
      refreshData();
    } catch (error) {
      console.error('Error updating blog', error);
      alert(`Error updating: ${error instanceof Error ? error.message : 'Unknown error'}. Changes saved locally.`);
      MockDatabase.updateBlog(blog.id, {
        seoTitle: blog.seoTitle,
        slug: blog.slug,
        metaDescription: blog.metaDescription,
        content: blog.content,
        tags: blog.tags,
      });
      setEditingPublishedBlog(null);
      refreshData();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteBlog = async (blogId: string) => {
    if (!confirm('Are you sure you want to delete this published blog?')) return;
    setDeletingBlogId(blogId);
    MockDatabase.updateBlog(blogId, { status: BlogStatus.REJECTED, comments: 'Deleted by user' });
    refreshData();
    setDeletingBlogId(null);
  };

  const handleReject = (id: string, reason: string) => {
    MockDatabase.updateBlog(id, { status: BlogStatus.REJECTED, comments: reason });
    setSelectedBlog(null);
    refreshData();
  };

  const handleImportCSV = () => {
    // Dummy import for MVP showcase
    const dummyTopics = [
      { title: "Top 10 AI Tools for SaaS", category: "AI", keywords: ["AI", "SaaS", "Tools"], audience: "Startup Founders" },
      { title: "Building a React App with Gemini", category: "Dev", keywords: ["React", "Gemini", "API"], audience: "Developers" },
      { title: "The Future of Content Marketing", category: "Marketing", keywords: ["SEO", "Content", "2025"], audience: "Marketers" }
    ];
    dummyTopics.forEach(t => MockDatabase.addTopic({
      title: t.title,
      category: t.category,
      keywords: t.keywords,
      targetAudience: t.audience
    }));
    refreshData();
    alert("Imported 3 sample topics!");
  };

  const renderDashboard = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Welcome Back, Editor</h2>
          <p className="text-slate-500 mt-1">Here's what's happening with your blog automation today.</p>
        </div>
        <button 
          onClick={handleRunScheduler}
          disabled={isGenerating}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all ${
            isGenerating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
          }`}
        >
          {isGenerating ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <ICONS.Clock className="w-5 h-5" />
          )}
          {isGenerating ? 'Generating Content...' : 'Run Scheduled Task Now'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Topics', value: stats.totalTopics, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending Review', value: stats.pendingReview, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Live Blogs', value: stats.publishedTotal, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Today Generated', value: stats.todayGenerated, color: 'text-indigo-600', bg: 'bg-indigo-50' },
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
            <button onClick={() => setActiveTab('topics')} className="text-indigo-600 text-sm font-semibold hover:underline">View All</button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topics.slice(0, 5).map(topic => (
                <tr key={topic.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{topic.title}</td>
                  <td className="px-6 py-4 text-slate-500">{topic.category}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      topic.status === BlogStatus.PENDING ? 'bg-blue-50 text-blue-600' :
                      topic.status === BlogStatus.GENERATED ? 'bg-amber-50 text-amber-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      {topic.status}
                    </span>
                  </td>
                </tr>
              ))}
              {topics.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400">No topics added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
             <div className="relative z-10">
               <h3 className="text-xl font-bold">Automation Status</h3>
               <p className="mt-2 text-indigo-100 opacity-90">Your next post is scheduled for tomorrow at {settings.generationTime}.</p>
               <div className="mt-6 p-4 bg-white/10 rounded-xl backdrop-blur-md">
                 <div className="flex items-center gap-3">
                   <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                   <span className="text-sm font-semibold">Scheduler Active</span>
                 </div>
               </div>
             </div>
             <div className="absolute top-0 right-0 p-8 opacity-10">
               <ICONS.Clock className="w-24 h-24" />
             </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800">Quick Actions</h3>
            <div className="mt-4 space-y-3">
              <button onClick={() => setShowAddTopic(true)} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-700 font-semibold transition-all">
                <ICONS.Plus className="w-5 h-5 text-indigo-600" />
                Add New Topic
              </button>
              <button onClick={handleImportCSV} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-700 font-semibold transition-all">
                <ICONS.Upload className="w-5 h-5 text-blue-600" />
                Import Sheet (.CSV)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTopics = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Topic Management</h2>
          <p className="text-slate-500">Add or import blog topics for the AI generator.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleImportCSV} className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-xl font-semibold hover:bg-slate-50 transition-all">
            <ICONS.Upload className="w-5 h-5" />
            Import CSV
          </button>
          <button onClick={() => setShowAddTopic(true)} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
            <ICONS.Plus className="w-5 h-5" />
            New Topic
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
              <th className="px-6 py-5">Status</th>
              <th className="px-6 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topics.map(topic => (
              <tr key={topic.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-5">
                  <div className="font-semibold text-slate-800">{topic.title}</div>
                  <div className="text-xs text-slate-400 mt-1">Keywords: {topic.keywords.join(', ')}</div>
                </td>
                <td className="px-6 py-5 text-slate-600 font-medium">{topic.category}</td>
                <td className="px-6 py-5 text-slate-500">{topic.targetAudience}</td>
                <td className="px-6 py-5">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                    topic.status === BlogStatus.PENDING ? 'bg-blue-100 text-blue-700' :
                    topic.status === BlogStatus.GENERATED ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {topic.status}
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <button className="text-slate-400 hover:text-indigo-600 font-semibold text-sm">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReviewQueue = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Review Queue</h2>
        <p className="text-slate-500">Approve or edit AI-generated blogs before they go live.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {blogs.filter(b => b.status === BlogStatus.GENERATED || b.status === BlogStatus.REJECTED).map(blog => (
          <div key={blog.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col hover:shadow-xl hover:shadow-slate-100 transition-all group">
            <div className="relative h-48">
              <img src={blog.featuredImageUrl} className="w-full h-full object-cover" alt="Featured" />
              <div className="absolute top-4 left-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${blog.status === BlogStatus.REJECTED ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'}`}>
                  {blog.status}
                </span>
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
              <button 
                onClick={() => setSelectedBlog(blog)}
                className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Review Content
              </button>
            </div>
          </div>
        ))}
        {blogs.filter(b => b.status === BlogStatus.GENERATED || b.status === BlogStatus.REJECTED).length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
            <ICONS.Review className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">Nothing in the review queue.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderPublished = () => (
    <div className="space-y-6">
       <div>
        <h2 className="text-3xl font-bold text-slate-800">Published Blogs</h2>
        <p className="text-slate-500">History of your automatically published content.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
        {blogs.filter(b => b.status === BlogStatus.PUBLISHED).map(blog => (
          <div key={blog.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
            <div className="flex items-center gap-6">
              <img src={blog.featuredImageUrl} className="w-20 h-20 rounded-xl object-cover border border-slate-200" alt="Thumb" />
              <div>
                <h4 className="font-bold text-slate-800 text-lg">{blog.seoTitle}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-semibold text-slate-400">Slug: /{blog.slug}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span className="text-xs font-semibold text-slate-400">Published: {new Date(blog.publishedAt!).toLocaleDateString()}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {blog.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-semibold">#{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingPublishedBlog(blog)}
                className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteBlog(blog.id)}
                disabled={deletingBlogId === blog.id}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                  deletingBlogId === blog.id
                    ? 'text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'text-rose-600 border border-rose-200 hover:bg-rose-50'
                }`}
              >
                {deletingBlogId === blog.id ? 'Deleting...' : 'Delete'}
              </button>
              <button className="p-2 text-slate-400 hover:text-indigo-600">
                <ICONS.External className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {blogs.filter(b => b.status === BlogStatus.PUBLISHED).length === 0 && (
          <div className="p-20 text-center text-slate-400">No blogs published yet.</div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => {
    const parsed = settings.curlCommand?.trim() ? parseCurlCommand(settings.curlCommand) : null;

    return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">System Settings</h2>
        <p className="text-slate-500">Configure your AI models and blog publish API.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold border-b border-slate-100 pb-4">AI Engine (Sarvam AI)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Sarvam AI API Key</label>
              <input
                type="password"
                value={settings.api_key}
                onChange={(e) => setSettings({...settings, api_key: e.target.value})}
                placeholder="Enter Sarvam AI Subscription Key"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Daily Generation Time</label>
              <input
                type="time"
                value={settings.generationTime}
                onChange={(e) => setSettings({...settings, generationTime: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Author / Reviewer Email</label>
              <input
                type="text"
                value={settings.reviewerEmail}
                onChange={(e) => setSettings({...settings, reviewerEmail: e.target.value})}
                placeholder="admin@example.com"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold border-b border-slate-100 pb-4">Blog Publish API (cURL)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Paste your cURL command</label>
              <textarea
                value={settings.curlCommand}
                onChange={(e) => setSettings({...settings, curlCommand: e.target.value})}
                placeholder={`curl -X POST https://yoursite.com/api/blogs \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -d '{"title": "", "content": "", "excerpt": ""}'`}
                rows={8}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs leading-relaxed resize-none"
              />
            </div>

            {parsed && parsed.url && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Parsed Config</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="font-semibold text-slate-600 min-w-[60px]">Method:</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">{parsed.method}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-slate-600 min-w-[60px]">URL:</span>
                    <span className="text-slate-700 break-all text-xs">{parsed.url}</span>
                  </div>
                  {Object.keys(parsed.headers).length > 0 && (
                    <div>
                      <span className="font-semibold text-slate-600">Headers:</span>
                      <div className="mt-1 space-y-1">
                        {Object.entries(parsed.headers).map(([key, value]) => (
                          <div key={key} className="text-xs text-slate-500 font-mono pl-2">
                            {key}: {value.length > 30 ? value.substring(0, 30) + '...' : value}
                          </div>
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
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] text-slate-400">Blog data will be sent using the URL, method, and headers above. If body fields are detected, only those fields will be sent from blog data.</p>
                </div>
              </div>
            )}

            {settings.curlCommand?.trim() && (!parsed || !parsed.url) && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-100">
                Could not parse a valid URL from the cURL command. Please check the format.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => {
            MockDatabase.saveSettings(settings);
            alert("Settings Saved!");
          }}
          className="px-10 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          Save Configuration
        </button>
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="ml-64 flex-1 p-10 max-w-7xl mx-auto">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'topics' && renderTopics()}
        {activeTab === 'review' && renderReviewQueue()}
        {activeTab === 'published' && renderPublished()}
        {activeTab === 'settings' && renderSettings()}
      </main>

      {/* Modals */}
      {showAddTopic && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in duration-200">
            <h3 className="text-2xl font-bold mb-6">Add New Topic</h3>
            <form onSubmit={handleAddTopic} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Topic Title</label>
                <input name="title" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="e.g. The Impact of Quantum Computing on Cybersecurity" />
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
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowAddTopic(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Add to Queue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedBlog && (
        <BlogEditor
          blog={selectedBlog}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setSelectedBlog(null)}
        />
      )}

      {editingPublishedBlog && (
        <BlogEditor
          blog={editingPublishedBlog}
          onApprove={handleUpdatePublished}
          onReject={(id, reason) => {
            setEditingPublishedBlog(null);
          }}
          onClose={() => setEditingPublishedBlog(null)}
        />
      )}
    </div>
  );
};

export default App;
