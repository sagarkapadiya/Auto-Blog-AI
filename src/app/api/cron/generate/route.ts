import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate } from "@/lib/auth";
import TopicModel from "@/models/Topic";
import BlogModel from "@/models/Blog";
import SettingsModel from "@/models/Settings";
import UserModel from "@/models/User";
import { SarvamService } from "@/lib/sarvamService";

function isCronAuthorized(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const headerSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    return headerSecret === secret || bearerToken === secret;
}

/** Allows cron secret OR authenticated user (for manual "Run Scheduled Task Now") */
async function isAuthorized(req: NextRequest): Promise<boolean> {
    if (isCronAuthorized(req)) return true;
    try {
        await authenticate(req);
        return true;
    } catch {
        return false;
    }
}

/**
 * GET/POST /api/cron/generate
 * Fetches ALL pending scheduled topics whose scheduledAt <= now,
 * groups them by user (batch), and processes each batch sequentially
 * with a 1-second delay between each blog generation.
 * Secured via CRON_SECRET (x-cron-secret header or Authorization: Bearer).
 * Vercel Cron uses GET; external schedulers can use POST.
 */
async function handleCronGenerate() {
    try {
        await connectDB();

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const processed: string[] = [];
        const failed: string[] = [];
        const skipped: string[] = [];

        // --- Step 1: Fetch ALL due topics in one query ---
        const dueTopics = await TopicModel.find({
            cronStatus: "SCHEDULED",
            status: "PENDING",
            scheduledAt: { $lte: now },
        }).sort({ scheduledAt: 1 });

        if (!dueTopics.length) {
            return Response.json({ message: "No scheduled topics due" });
        }

        console.log(`📋 Cron: Found ${dueTopics.length} due topic(s). Grouping by user…`);

        // --- Step 2: Group topics by user (batch per user) ---
        const userBatches = new Map<string, typeof dueTopics>();
        for (const topic of dueTopics) {
            const userId = topic.createdBy.toString();
            if (!userBatches.has(userId)) {
                userBatches.set(userId, []);
            }
            userBatches.get(userId)!.push(topic);
        }

        // --- Step 3: Process each user batch sequentially ---
        for (const [userId, topics] of userBatches) {
            console.log(`👤 Cron: Processing batch for user ${userId} — ${topics.length} topic(s)`);

            // Fetch user's monthly limit
            const user = await UserModel.findById(userId)
                .select("monthlyPublishLimit")
                .lean<{ monthlyPublishLimit?: number }>();
            const limit = user?.monthlyPublishLimit ?? 0;

            // Fetch current monthly generation count for this user
            let monthlyCount = 0;
            if (limit > 0) {
                monthlyCount = await BlogModel.countDocuments({
                    createdBy: userId,
                    status: { $ne: "REJECTED" },
                    createdAt: { $gte: monthStart, $lt: monthEnd },
                });
            }

            // Fetch user's API settings once per batch
            const settings = await SettingsModel.findOne({ userId });
            if (!settings?.api_key) {
                console.warn(`⚠ Cron: No API key for user ${userId} — skipping ${topics.length} topic(s)`);
                for (const topic of topics) {
                    skipped.push(topic.title);
                }
                continue;
            }

            // Reuse the same SarvamService instance for the entire user batch
            const sarvam = new SarvamService(settings.api_key);

            // Process each topic in this user's batch
            for (const topic of topics) {
                // Monthly limit check
                if (limit > 0 && monthlyCount >= limit) {
                    console.warn(
                        `⏸ Cron: Skipping topic "${topic.title}" — user ${userId} monthly limit reached (${monthlyCount}/${limit})`
                    );
                    skipped.push(topic.title);
                    continue;
                }

                try {
                    // Throttle: 1-second delay before each generation
                    await new Promise((r) => setTimeout(r, 1000));

                    const generated = await sarvam.generateBlog({
                        title: topic.title,
                        category: topic.category,
                        keywords: topic.keywords,
                        targetAudience: topic.targetAudience,
                        _id: topic._id.toString(),
                    });

                    if (!generated.content?.trim()) {
                        throw new Error("AI returned empty content");
                    }

                    await BlogModel.create({
                        ...generated,
                        featuredImageUrl: `https://picsum.photos/seed/${Date.now()}/1200/630`,
                        createdBy: topic.createdBy,
                    });

                    topic.status = "GENERATED";
                    topic.cronStatus = "DONE";
                    await topic.save();
                    processed.push(topic.title);

                    monthlyCount++;
                    console.log(`✅ Cron: Generated blog for topic "${topic.title}" (${topic._id})`);
                } catch (topicErr: any) {
                    console.error(
                        `❌ Cron: Failed for topic "${topic.title}" (${topic._id}):`,
                        topicErr?.message ?? topicErr
                    );
                    try {
                        topic.cronStatus = "FAILED";
                        await topic.save();
                    } catch (saveErr) {
                        console.error(`Could not save FAILED status for topic ${topic._id}:`, saveErr);
                    }
                    failed.push(topic.title);
                }
            }
        }

        const totalDue = processed.length + failed.length + skipped.length;
        return Response.json({
            message: `Processed ${totalDue} topic(s): ${processed.length} generated, ${failed.length} failed, ${skipped.length} skipped`,
            generated: processed,
            failed,
            skipped,
        });
    } catch (error: any) {
        console.error("Cron generate error:", error);
        return Response.json({ error: error.message || "Cron job failed" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    if (!(await isAuthorized(req))) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleCronGenerate();
}

export async function POST(req: NextRequest) {
    if (!(await isAuthorized(req))) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleCronGenerate();
}
