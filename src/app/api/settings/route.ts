import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, requireAdmin, authErrorResponse } from "@/lib/auth";
import SettingsModel from "@/models/Settings";

/** GET /api/settings — Get user settings (all authenticated users) */
export async function GET(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        await connectDB();

        let settings = await SettingsModel.findOne({ userId: authUser._id }).lean();
        if (!settings) {
            settings = {
                userId: authUser._id,
                api_key: "",
                generationTime: "09:00",
                reviewerEmail: "",
                curlCommand: "",
            } as any;
        }

        return Response.json({ settings });
    } catch (error) {
        return authErrorResponse(error);
    }
}

/** PUT /api/settings — Update user settings (ADMIN only) */
export async function PUT(req: NextRequest) {
    try {
        const authUser = await authenticate(req);
        requireAdmin(authUser);
        const updates = await req.json();

        await connectDB();

        const settings = await SettingsModel.findOneAndUpdate(
            { userId: authUser._id },
            {
                userId: authUser._id,
                api_key: updates.api_key ?? "",
                generationTime: updates.generationTime ?? "09:00",
                reviewerEmail: updates.reviewerEmail ?? "",
                curlCommand: updates.curlCommand ?? "",
            },
            { upsert: true, new: true }
        );

        return Response.json({ settings });
    } catch (error) {
        return authErrorResponse(error);
    }
}
