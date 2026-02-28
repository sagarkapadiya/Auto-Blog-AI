import mongoose, { Schema, models, model } from "mongoose";

export interface IBlogDoc extends mongoose.Document {
    topicId: mongoose.Types.ObjectId;
    seoTitle: string;
    metaDescription: string;
    slug: string;
    content: string;
    tags: string[];
    featuredImagePrompt: string;
    featuredImageUrl?: string;
    status: string;
    publishedAt?: Date;
    comments?: string;
    publishApiResponse?: Record<string, unknown>;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
}

const BlogSchema = new Schema<IBlogDoc>(
    {
        topicId: { type: Schema.Types.ObjectId, ref: "Topic", required: true },
        seoTitle: { type: String, required: true },
        metaDescription: { type: String, default: "" },
        slug: { type: String, required: true },
        content: { type: String, required: true },
        tags: [{ type: String }],
        featuredImagePrompt: { type: String, default: "" },
        featuredImageUrl: { type: String },
        status: { type: String, enum: ["PENDING", "GENERATED", "UNDER_REVIEW", "APPROVED", "PUBLISHED", "REJECTED"], default: "GENERATED" },
        publishedAt: { type: Date },
        comments: { type: String },
        publishApiResponse: { type: Schema.Types.Mixed },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

const Blog = models.Blog || model<IBlogDoc>("Blog", BlogSchema);

export default Blog;
