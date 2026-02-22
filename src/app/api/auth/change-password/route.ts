import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import User from "@/models/User";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export async function POST(req: NextRequest) {
    try {
        const authUser = await authenticate(req);

        const { currentPassword, newPassword, confirmPassword } = await req.json();

        // --- Validation ---
        if (!currentPassword || !newPassword || !confirmPassword) {
            return Response.json(
                { success: false, error: "All fields are required" },
                { status: 400 }
            );
        }

        if (newPassword !== confirmPassword) {
            return Response.json(
                { success: false, error: "New password and confirm password do not match" },
                { status: 400 }
            );
        }

        if (currentPassword === newPassword) {
            return Response.json(
                { success: false, error: "New password must be different from the current password" },
                { status: 400 }
            );
        }

        if (!PASSWORD_REGEX.test(newPassword)) {
            return Response.json(
                {
                    success: false,
                    error: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
                },
                { status: 400 }
            );
        }

        // --- Fetch user with password field ---
        await connectDB();
        const user = await User.findById(authUser._id).select("+password");

        if (!user) {
            return Response.json(
                { success: false, error: "User not found" },
                { status: 401 }
            );
        }

        // --- Verify current password ---
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return Response.json(
                { success: false, error: "Current password is incorrect" },
                { status: 401 }
            );
        }

        // --- Hash and save new password ---
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        return Response.json(
            { success: true, message: "Password updated successfully" },
            { status: 200 }
        );
    } catch (error) {
        return authErrorResponse(error);
    }
}
