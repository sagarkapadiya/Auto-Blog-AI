
import { Topic, BlogContent, BlogStatus, Settings, DashboardStats } from '../types';

const STORAGE_KEYS = {
  TOPICS: 'autoblog_topics',
  BLOGS: 'autoblog_blogs',
  SETTINGS: 'autoblog_settings',
};

const DEFAULT_SETTINGS: Settings = {
  api_key: '',
  generationTime: '09:00',
  reviewerEmail: 'admin@example.com',
  curlCommand: '',
};

export class MockDatabase {
  static getTopics(): Topic[] {
    const data = localStorage.getItem(STORAGE_KEYS.TOPICS);
    return data ? JSON.parse(data) : [];
  }

  static saveTopics(topics: Topic[]) {
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
  }

  static addTopic(topic: Omit<Topic, 'id' | 'createdAt' | 'status'>): Topic {
    const topics = this.getTopics();
    const newTopic: Topic = {
      ...topic,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      status: BlogStatus.PENDING,
    };
    topics.unshift(newTopic);
    this.saveTopics(topics);
    return newTopic;
  }

  static updateTopicStatus(id: string, status: BlogStatus) {
    const topics = this.getTopics();
    const idx = topics.findIndex(t => t.id === id);
    if (idx !== -1) {
      topics[idx].status = status;
      this.saveTopics(topics);
    }
  }

  static getBlogs(): BlogContent[] {
    const data = localStorage.getItem(STORAGE_KEYS.BLOGS);
    return data ? JSON.parse(data) : [];
  }

  static saveBlogs(blogs: BlogContent[]) {
    localStorage.setItem(STORAGE_KEYS.BLOGS, JSON.stringify(blogs));
  }

  static addBlog(blog: Omit<BlogContent, 'id'>): BlogContent {
    const blogs = this.getBlogs();
    const newBlog: BlogContent = {
      ...blog,
      id: Math.random().toString(36).substr(2, 9),
    };
    blogs.unshift(newBlog);
    this.saveBlogs(blogs);
    this.updateTopicStatus(blog.topicId, blog.status);
    return newBlog;
  }

  static updateBlog(id: string, updates: Partial<BlogContent>) {
    const blogs = this.getBlogs();
    const idx = blogs.findIndex(b => b.id === id);
    if (idx !== -1) {
      blogs[idx] = { ...blogs[idx], ...updates };
      this.saveBlogs(blogs);
      if (updates.status) {
        this.updateTopicStatus(blogs[idx].topicId, updates.status);
      }
    }
  }

  static getSettings(): Settings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  }

  static saveSettings(settings: Settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  static getStats(): DashboardStats {
    const topics = this.getTopics();
    const blogs = this.getBlogs();
    
    return {
      totalTopics: topics.length,
      pendingReview: blogs.filter(b => b.status === BlogStatus.GENERATED).length,
      publishedTotal: blogs.filter(b => b.status === BlogStatus.PUBLISHED).length,
      todayGenerated: blogs.filter(b => {
        const d = new Date(b.id === 'temp' ? Date.now() : 0); // simplistic check
        return false; // dynamic calculation not stored yet
      }).length,
    };
  }
}
