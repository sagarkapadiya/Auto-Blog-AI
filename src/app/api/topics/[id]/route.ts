import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import TopicModel from "@/models/Topic";

/** DELETE /api/topics/:id — Delete a topic */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authUser = await authenticate(req);
        const { id } = await params;
        await connectDB();

        const topic = await TopicModel.findOneAndDelete({
            _id: id,
            createdBy: authUser._id,
        });

        if (!topic) {
            return Response.json({ error: "Topic not found" }, { status: 404 });
        }

        return Response.json({ message: "Topic deleted" });
    } catch (error) {
        return authErrorResponse(error);
    }
}

/** PATCH /api/topics/:id — Partially update a topic (e.g. reset cronStatus for retry) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authUser = await authenticate(req);
        const { id } = await params;
        const body = await req.json();
        await connectDB();

        // Only allow patching safe fields; status fields managed by cron
        const allowedFields: Record<string, unknown> = {};
        if (body.cronStatus !== undefined) allowedFields.cronStatus = body.cronStatus;
        if (body.scheduledAt !== undefined) allowedFields.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
        if (body.title !== undefined) allowedFields.title = body.title;
        if (body.category !== undefined) allowedFields.category = body.category;
        if (body.targetAudience !== undefined) allowedFields.targetAudience = body.targetAudience;
        if (body.keywords !== undefined) allowedFields.keywords = body.keywords;
        if (body.postedBy !== undefined) allowedFields.postedBy = body.postedBy;

        const topic = await TopicModel.findOneAndUpdate(
            { _id: id, createdBy: authUser._id },
            { $set: allowedFields },
            { new: true }
        );

        if (!topic) {
            return Response.json({ error: "Topic not found" }, { status: 404 });
        }

        return Response.json({ topic });
    } catch (error) {
        return authErrorResponse(error);
    }
}
