import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import TopicModel from "@/models/Topic";

/** POST /api/topics/bulk — Create multiple topics */
export async function POST(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        const { topics } = await req.json();

        if (!topics || !Array.isArray(topics) || topics.length === 0) {
            return Response.json({ error: "No topics provided" }, { status: 400 });
        }

        await connectDB();

        const batchTimestamp = new Date();

        const topicsToInsert = topics.map((topic: any, index: number) => ({
            title: topic.title,
            category: topic.category,
            keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
            targetAudience: topic.targetAudience || "",
            status: "PENDING",
            scheduledAt: null,
            cronStatus: "NONE",
            postedBy: topic.postedBy || "",
            sortOrder: index + 1,
            createdAt: batchTimestamp,
            updatedAt: batchTimestamp,
            createdBy: authUser._id,
        }));

        console.log("[bulk-import] First topic to insert:", JSON.stringify(topicsToInsert[0], null, 2));
        const result = await TopicModel.insertMany(topicsToInsert, { ordered: true });
        console.log("[bulk-import] First inserted doc:", JSON.stringify(result[0]?.toObject(), null, 2));

        return Response.json({ message: `Successfully inserted ${result.length} topics`, count: result.length }, { status: 201 });
    } catch (error) {
        return authErrorResponse(error);
    }
}
