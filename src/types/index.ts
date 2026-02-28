export enum BlogStatus {
    PENDING = "PENDING",
    GENERATED = "GENERATED",
    UNDER_REVIEW = "UNDER_REVIEW",
    APPROVED = "APPROVED",
    PUBLISHED = "PUBLISHED",
    REJECTED = "REJECTED",
}

export enum UserRole {
    USER = "USER",
    ADMIN = "ADMIN",
}

export interface IUser {
    _id: string;
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    isActive: boolean;
    monthlyPublishLimit: number;
    createdAt: string;
    updatedAt: string;
}

export interface Topic {
    _id: string;
    title: string;
    category: string;
    keywords: string[];
    targetAudience: string;
    status: BlogStatus;
    createdBy?: string;
    createdAt: string;
}

export interface BlogContent {
    _id: string;
    topicId: string;
    seoTitle: string;
    metaDescription: string;
    slug: string;
    content: string;
    tags: string[];
    featuredImagePrompt: string;
    featuredImageUrl?: string;
    status: BlogStatus;
    publishedAt?: string;
    comments?: string;
    createdBy?: string;
}

export interface Settings {
    _id?: string;
    userId: string;
    api_key: string;
    generationTime: string;
    reviewerEmail: string;
    curlCommand: string;
    deleteCurlCommand: string;
}

export interface DashboardStats {
    totalTopics: number;
    pendingReview: number;
    publishedTotal: number;
    todayGenerated: number;
}

export interface AuthContextType {
    user: IUser | null;
    token: string | null;
    isLoading: boolean;
    isAdmin: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}
