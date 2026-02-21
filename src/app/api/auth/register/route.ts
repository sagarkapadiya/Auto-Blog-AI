import { NextRequest } from "next/server";

export async function POST(_req: NextRequest) {
    return Response.json(
        { error: "Self-registration is disabled. Users can only be added by an administrator." },
        { status: 403 }
    );
}
