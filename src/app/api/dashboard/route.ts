import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import TopicModel from "@/models/Topic";
import BlogModel from "@/models/Blog";
import UserModel from "@/models/User";

/** GET /api/dashboard — Get dashboard stats */
export async function GET(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        await connectDB();

        const filter = { createdBy: authUser._id };

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const [totalTopics, pendingReview, publishedTotal, todayGenerated, monthlyPublished, user] = await Promise.all([
            TopicModel.countDocuments(filter),
            BlogModel.countDocuments({ ...filter, status: "GENERATED" }),
            BlogModel.countDocuments({ ...filter, status: "PUBLISHED" }),
            BlogModel.countDocuments({
                ...filter,
                createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            }),
            BlogModel.countDocuments({
                ...filter,
                status: "PUBLISHED",
                publishedAt: { $gte: monthStart, $lt: monthEnd },
            }),
            UserModel.findById(authUser._id).select("monthlyPublishLimit").lean<{ monthlyPublishLimit?: number }>(),
        ]);

        const monthlyPublishLimit = user?.monthlyPublishLimit ?? 0;

        return Response.json({
            stats: { totalTopics, pendingReview, publishedTotal, todayGenerated, monthlyPublished, monthlyPublishLimit },
        });
    } catch (error) {
        return authErrorResponse(error);
    }
}
