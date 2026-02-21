import { NextRequest } from "next/server";
import { authenticate, authErrorResponse } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const user = await authenticate(req);
        return Response.json({ user });
    } catch (error) {
        return authErrorResponse(error);
    }
}
