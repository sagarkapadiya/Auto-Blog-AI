import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import TopicModel from "@/models/Topic";
import BlogModel from "@/models/Blog";

/** GET /api/dashboard — Get dashboard stats */
export async function GET(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        await connectDB();

        const filter = { createdBy: authUser._id };

        const [totalTopics, pendingReview, publishedTotal, todayGenerated] = await Promise.all([
            TopicModel.countDocuments(filter),
            BlogModel.countDocuments({ ...filter, status: "GENERATED" }),
            BlogModel.countDocuments({ ...filter, status: "PUBLISHED" }),
            BlogModel.countDocuments({
                ...filter,
                createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            }),
        ]);

        return Response.json({
            stats: { totalTopics, pendingReview, publishedTotal, todayGenerated },
        });
    } catch (error) {
        return authErrorResponse(error);
    }
}
