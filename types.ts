
export enum BlogStatus {
  PENDING = 'PENDING',
  GENERATED = 'GENERATED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED'
}

export interface Topic {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  targetAudience: string;
  status: BlogStatus;
  createdAt: number;
}

export interface BlogContent {
  id: string;
  topicId: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
  content: string; // Markdown/HTML
  tags: string[];
  featuredImagePrompt: string;
  featuredImageUrl?: string;
  status: BlogStatus;
  publishedAt?: number;
  comments?: string;
}

export interface Settings {
  api_key: string;
  generationTime: string; // e.g., "09:00"
  reviewerEmail: string;
  curlCommand: string; // Raw cURL command pasted by user
}

export interface DashboardStats {
  totalTopics: number;
  pendingReview: number;
  publishedTotal: number;
  todayGenerated: number;
}
