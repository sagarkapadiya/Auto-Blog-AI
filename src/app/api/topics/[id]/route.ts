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
