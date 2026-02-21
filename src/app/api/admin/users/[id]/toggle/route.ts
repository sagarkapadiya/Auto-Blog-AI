import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, requireAdmin, authErrorResponse } from "@/lib/auth";
import User from "@/models/User";

/** PATCH /api/admin/users/[id]/toggle — Activate/Deactivate user (ADMIN only) */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await authenticate(req);
        requireAdmin(authUser);

        const { id } = await params;

        await connectDB();

        const user = await User.findById(id);
        if (!user) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }

        // Prevent admin from deactivating themselves
        if (user._id.toString() === authUser._id) {
            return Response.json({ error: "Cannot deactivate your own account" }, { status: 400 });
        }

        user.isActive = !user.isActive;
        await user.save();

        return Response.json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
            },
            message: user.isActive ? "User activated" : "User deactivated",
        });
    } catch (error) {
        return authErrorResponse(error);
    }
}
