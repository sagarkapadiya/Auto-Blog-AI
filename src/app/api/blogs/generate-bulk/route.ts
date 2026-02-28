import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import TopicModel from "@/models/Topic";
import BlogModel from "@/models/Blog";
import SettingsModel from "@/models/Settings";
import UserModel from "@/models/User";
import { SarvamService } from "@/lib/sarvamService";

/** POST /api/blogs/generate-bulk — Generate multiple blogs from pending topics */
export async function POST(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        await connectDB();

        const body = await req.json().catch(() => ({}));
        const count = Math.min(Math.max(Number(body.count) || 5, 1), 10);

        // --- Monthly generation limit check ---
        const user = await UserModel.findById(authUser._id)
            .select("monthlyPublishLimit")
            .lean<{ monthlyPublishLimit?: number }>();
        const limit = user?.monthlyPublishLimit ?? 0;

        let remaining = count;

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

            remaining = Math.min(count, limit - generatedThisMonth);
        }

        // Get user settings for API key
        const settings = await SettingsModel.findOne({ userId: authUser._id });
        if (!settings?.api_key) {
            return Response.json(
                { error: "Please add an API Key in Settings first" },
                { status: 400 }
            );
        }

        const now = new Date();

        // Fetch due scheduled topics first
        const scheduledTopics = await TopicModel.find({
            createdBy: authUser._id,
            status: "PENDING",
            cronStatus: "SCHEDULED",
            scheduledAt: { $lte: now },
        })
            .sort({ sortOrder: 1, _id: -1 })
            .limit(remaining);

        const scheduledCount = scheduledTopics.length;
        const needMore = remaining - scheduledCount;

        // Fill the rest with non-scheduled pending topics (newest first, matching Topic Hub display)
        let normalTopics: any[] = [];
        if (needMore > 0) {
            const excludeIds = scheduledTopics.map((t: any) => t._id);
            normalTopics = await TopicModel.find({
                createdBy: authUser._id,
                status: "PENDING",
                _id: { $nin: excludeIds },
            })
                .sort({ sortOrder: 1, _id: -1 })
                .limit(needMore);
        }

        const allTopics = [...scheduledTopics, ...normalTopics];

        if (allTopics.length === 0) {
            return Response.json(
                { error: "No pending topics found in queue" },
                { status: 404 }
            );
        }

        const sarvam = new SarvamService(settings.api_key);

        let generated = 0;
        let failed = 0;
        const failedTopics: string[] = [];
        const failedDetails: { title: string; error: string }[] = [];

        // Process topics sequentially with throttling to avoid rate limits
        for (let i = 0; i < allTopics.length; i++) {
            const topic = allTopics[i];

            // Throttle: wait 1 second before sending each topic to the model
            await new Promise((r) => setTimeout(r, 1000));
            let lastError = "";
            let success = false;

            // Retry up to 3 attempts per topic with a delay between retries
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    if (attempt > 1) {
                        // Wait 2 seconds before retrying
                        await new Promise((r) => setTimeout(r, 2000));
                    }

                    const result = await sarvam.generateBlog({
                        title: topic.title,
                        category: topic.category,
                        keywords: topic.keywords,
                        targetAudience: topic.targetAudience,
                        _id: topic._id.toString(),
                    });

                    await BlogModel.create({
                        ...result,
                        featuredImageUrl: `https://picsum.photos/seed/${Date.now()}/1200/630`,
                        createdBy: authUser._id,
                    });

                    topic.status = "GENERATED";
                    if (topic.cronStatus === "SCHEDULED") {
                        topic.cronStatus = "DONE";
                    }
                    await topic.save();

                    generated++;
                    success = true;

                    // Cooldown: wait 500ms after generation before next topic
                    await new Promise((r) => setTimeout(r, 1000));
                    break;
                } catch (err: any) {
                    lastError = err?.message || "Unknown error";
                    console.error(`[generate-bulk] Attempt ${attempt}/3 failed for topic: "${topic.title}"`, lastError);
                }
            }

            if (!success) {
                failed++;
                failedTopics.push(topic.title);
                failedDetails.push({ title: topic.title, error: lastError });
            }
        }

        return Response.json(
            {
                generated,
                failed,
                total: allTopics.length,
                failedTopics,
                failedDetails,
                message: `${generated} blog${generated !== 1 ? "s" : ""} generated successfully.`,
            },
            { status: 201 }
        );
    } catch (error) {
        return authErrorResponse(error);
    }
}
