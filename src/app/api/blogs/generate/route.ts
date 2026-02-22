import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import TopicModel from "@/models/Topic";
import BlogModel from "@/models/Blog";
import SettingsModel from "@/models/Settings";
import UserModel from "@/models/User";
import { SarvamService } from "@/lib/sarvamService";

/** POST /api/blogs/generate — Generate a blog from the next pending topic */
export async function POST(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        await connectDB();

        // --- Monthly generation limit check ---
        const user = await UserModel.findById(authUser._id).select("monthlyPublishLimit").lean<{ monthlyPublishLimit?: number }>();
        const limit = user?.monthlyPublishLimit ?? 0;

        if (limit > 0) {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            const generatedThisMonth = await BlogModel.countDocuments({
                createdBy: authUser._id,
                status: { $ne: "REJECTED" },
                createdAt: { $gte: monthStart, $lt: monthEnd },
            });

            if (generatedThisMonth >= limit) {
                return Response.json(
                    { error: `Monthly limit reached (${generatedThisMonth}/${limit}). Please contact your admin to increase your monthly limit.` },
                    { status: 403 }
                );
            }
        }

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

        if (!generated.content?.trim()) {
            return Response.json(
                { error: "AI failed to generate blog content. Please try again." },
                { status: 502 }
            );
        }

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
