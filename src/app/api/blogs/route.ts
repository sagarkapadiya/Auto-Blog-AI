import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import BlogModel from "@/models/Blog";

/** GET /api/blogs — List all blogs for current user */
export async function GET(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        await connectDB();

        const blogs = await BlogModel.find({ createdBy: authUser._id })
            .sort({ createdAt: -1 })
            .lean();

        return Response.json({ blogs });
    } catch (error) {
        return authErrorResponse(error);
    }
}
