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
 * Processes all scheduled topics whose scheduledAt has passed.
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
        const processedIds: string[] = [];

        // Track per-user generation counts this month to avoid repeated DB queries
        const userMonthlyCountCache = new Map<string, number>();

        const findNextDue = () =>
            TopicModel.findOne({
                cronStatus: "SCHEDULED",
                status: "PENDING",
                scheduledAt: { $lte: now },
                ...(processedIds.length ? { _id: { $nin: processedIds } } : {}),
            }).sort({ scheduledAt: 1 });

        let dueTopic = await findNextDue();

        while (dueTopic) {
            // Always push to processedIds so we never re-visit this topic
            processedIds.push(dueTopic._id.toString());

            const userId = dueTopic.createdBy.toString();

            // --- Monthly generation limit check (per user) ---
            const user = await UserModel.findById(userId).select("monthlyPublishLimit").lean<{ monthlyPublishLimit?: number }>();
            const limit = user?.monthlyPublishLimit ?? 0;

            if (limit > 0) {
                if (!userMonthlyCountCache.has(userId)) {
                    const count = await BlogModel.countDocuments({
                        createdBy: userId,
                        status: { $ne: "REJECTED" },
                        createdAt: { $gte: monthStart, $lt: monthEnd },
                    });
                    userMonthlyCountCache.set(userId, count);
                }

                const currentCount = userMonthlyCountCache.get(userId)!;
                if (currentCount >= limit) {
                    console.warn(`⏸ Cron: Skipping topic "${dueTopic.title}" — user ${userId} monthly limit reached (${currentCount}/${limit})`);
                    skipped.push(dueTopic.title);
                    dueTopic = await findNextDue();
                    continue;
                }
            }

            const settings = await SettingsModel.findOne({ userId: dueTopic.createdBy });
            if (!settings?.api_key) {
                console.warn(`Skipping topic ${dueTopic._id}: No API key for user ${dueTopic.createdBy}`);
                skipped.push(dueTopic.title);
            } else {
                try {
                    const sarvam = new SarvamService(settings.api_key);
                    const generated = await sarvam.generateBlog({
                        title: dueTopic.title,
                        category: dueTopic.category,
                        keywords: dueTopic.keywords,
                        targetAudience: dueTopic.targetAudience,
                        _id: dueTopic._id.toString(),
                    });

                    if (!generated.content?.trim()) {
                        throw new Error("AI returned empty content");
                    }

                    await BlogModel.create({
                        ...generated,
                        featuredImageUrl: `https://picsum.photos/seed/${Date.now()}/1200/630`,
                        createdBy: dueTopic.createdBy,
                    });

                    dueTopic.status = "GENERATED";
                    dueTopic.cronStatus = "DONE";
                    await dueTopic.save();
                    processed.push(dueTopic.title);

                    // Increment the cached count for this user
                    const prev = userMonthlyCountCache.get(userId) ?? 0;
                    userMonthlyCountCache.set(userId, prev + 1);

                    console.log(`✅ Cron: Generated blog for topic "${dueTopic.title}" (${dueTopic._id})`);
                } catch (topicErr: any) {
                    // Mark as FAILED so it won't be retried on every future cron run
                    console.error(`❌ Cron: Failed for topic "${dueTopic.title}" (${dueTopic._id}):`, topicErr?.message ?? topicErr);
                    try {
                        dueTopic.cronStatus = "FAILED";
                        await dueTopic.save();
                    } catch (saveErr) {
                        console.error(`Could not save FAILED status for topic ${dueTopic._id}:`, saveErr);
                    }
                    failed.push(dueTopic.title);
                }
            }

            dueTopic = await findNextDue();
        }

        const totalDue = processed.length + failed.length + skipped.length;
        if (totalDue === 0) {
            return Response.json({ message: "No scheduled topics due" });
        }

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
