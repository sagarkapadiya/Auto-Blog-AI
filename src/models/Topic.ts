import mongoose, { Schema, models, model } from "mongoose";

export interface ITopicDoc extends mongoose.Document {
    title: string;
    category: string;
    keywords: string[];
    targetAudience: string;
    status: string;
    scheduledAt?: Date;
    cronStatus: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    postedBy?: string;
}

const TopicSchema = new Schema<ITopicDoc>(
    {
        title: { type: String, required: true },
        category: { type: String, required: true },
        keywords: [{ type: String }],
        targetAudience: { type: String, required: true },
        status: { type: String, enum: ["PENDING", "GENERATED", "UNDER_REVIEW", "APPROVED", "PUBLISHED", "REJECTED"], default: "PENDING" },
        scheduledAt: { type: Date, default: null },
        cronStatus: { type: String, enum: ["NONE", "SCHEDULED", "DONE", "FAILED"], default: "NONE" },
        postedBy: { type: String, default: "" },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

const Topic = models.Topic || model<ITopicDoc>("Topic", TopicSchema);

export default Topic;
