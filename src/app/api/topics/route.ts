import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import TopicModel from "@/models/Topic";

/** GET /api/topics — List all topics */
export async function GET(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        await connectDB();

        const topics = await TopicModel.find({ createdBy: authUser._id })
            .sort({ sortOrder: 1, _id: -1 })
            .lean();

        return Response.json({ topics });
    } catch (error) {
        return authErrorResponse(error);
    }
}

/** POST /api/topics — Create a new topic */
export async function POST(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        const { title, category, keywords, targetAudience, scheduledAt, postedBy } = await req.json();

        if (!title || !category) {
            return Response.json({ error: "Title and category are required" }, { status: 400 });
        }

        if (scheduledAt) {
            const minAllowed = new Date();
            minAllowed.setMinutes(minAllowed.getMinutes() + 4);
            if (new Date(scheduledAt) < minAllowed) {
                return Response.json({ error: "Scheduled time must be at least 5 minutes from now" }, { status: 400 });
            }
        }

        await connectDB();

        const topic = await TopicModel.create({
            title,
            category,
            keywords: keywords || [],
            targetAudience: targetAudience || "",
            status: "PENDING",
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            cronStatus: scheduledAt ? "SCHEDULED" : "NONE",
            postedBy: postedBy || "",
            createdBy: authUser._id,
        });

        return Response.json({ topic }, { status: 201 });
    } catch (error) {
        return authErrorResponse(error);
    }
}
