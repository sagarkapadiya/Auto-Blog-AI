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

        const topicsToInsert = topics.map((topic: any) => ({
            title: topic.title,
            category: topic.category,
            keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
            targetAudience: topic.targetAudience || "",
            status: "PENDING",
            scheduledAt: null,
            cronStatus: "NONE",
            postedBy: topic.postedBy || "",
            createdBy: authUser._id,
        }));

        const result = await TopicModel.insertMany(topicsToInsert);

        return Response.json({ message: `Successfully inserted ${result.length} topics`, count: result.length }, { status: 201 });
    } catch (error) {
        return authErrorResponse(error);
    }
}
