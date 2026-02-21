import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate } from "@/lib/auth";
import TopicModel from "@/models/Topic";
import BlogModel from "@/models/Blog";
import SettingsModel from "@/models/Settings";
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
        const processed: string[] = [];
        const skipIds: string[] = [];

        const findNextDue = () =>
            TopicModel.findOne({
                cronStatus: "SCHEDULED",
                status: "PENDING",
                scheduledAt: { $lte: now },
                ...(skipIds.length ? { _id: { $nin: skipIds } } : {}),
            }).sort({ scheduledAt: 1 });

        let dueTopic = await findNextDue();

        while (dueTopic) {
            const settings = await SettingsModel.findOne({ userId: dueTopic.createdBy });
            if (!settings?.api_key) {
                console.warn(`Skipping topic ${dueTopic._id}: No API key for user ${dueTopic.createdBy}`);
                skipIds.push(dueTopic._id.toString());
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

                    await BlogModel.create({
                        ...generated,
                        featuredImageUrl: `https://picsum.photos/seed/${Date.now()}/1200/630`,
                        createdBy: dueTopic.createdBy,
                    });

                    dueTopic.status = "GENERATED";
                    dueTopic.cronStatus = "DONE";
                    await dueTopic.save();
                    processed.push(dueTopic.title);
                } catch (topicErr: any) {
                    console.error(`Cron failed for topic ${dueTopic._id}:`, topicErr);
                    throw topicErr;
                }
            }

            dueTopic = await findNextDue();
        }

        if (processed.length === 0) {
            return Response.json({ message: "No scheduled topics due" });
        }

        return Response.json({
            message: `Generated ${processed.length} blog(s)`,
            topics: processed,
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
