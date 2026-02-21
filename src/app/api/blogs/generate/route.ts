import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import TopicModel from "@/models/Topic";
import BlogModel from "@/models/Blog";
import SettingsModel from "@/models/Settings";
import { SarvamService } from "@/lib/sarvamService";

/** POST /api/blogs/generate — Generate a blog from the next pending topic */
export async function POST(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        await connectDB();

        // Get user settings for API key
        const settings = await SettingsModel.findOne({ userId: authUser._id });
        if (!settings?.api_key) {
            return Response.json({ error: "Please add an API Key in Settings first" }, { status: 400 });
        }

        const now = new Date();

        // Prefer due scheduled topics first (scheduledAt has passed)
        let pendingTopic = await TopicModel.findOne({
            createdBy: authUser._id,
            status: "PENDING",
            cronStatus: "SCHEDULED",
            scheduledAt: { $lte: now },
        }).sort({ scheduledAt: 1 });

        // Fall back to oldest non-scheduled or not-yet-due pending topic
        if (!pendingTopic) {
            pendingTopic = await TopicModel.findOne({
                createdBy: authUser._id,
                status: "PENDING",
            }).sort({ createdAt: 1 });
        }

        if (!pendingTopic) {
            return Response.json({ error: "No pending topics found in queue" }, { status: 404 });
        }

        // Generate blog content
        const sarvam = new SarvamService(settings.api_key);
        const generated = await sarvam.generateBlog({
            title: pendingTopic.title,
            category: pendingTopic.category,
            keywords: pendingTopic.keywords,
            targetAudience: pendingTopic.targetAudience,
            _id: pendingTopic._id.toString(),
        });

        // Save generated blog
        const blog = await BlogModel.create({
            ...generated,
            featuredImageUrl: `https://picsum.photos/seed/${Date.now()}/1200/630`,
            createdBy: authUser._id,
        });

        pendingTopic.status = "GENERATED";
        if (pendingTopic.cronStatus === "SCHEDULED") {
            pendingTopic.cronStatus = "DONE";
        }
        await pendingTopic.save();

        return Response.json({ blog }, { status: 201 });
    } catch (error) {
        return authErrorResponse(error);
    }
}
