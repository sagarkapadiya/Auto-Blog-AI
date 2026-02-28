import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import BlogModel from "@/models/Blog";
import SettingsModel from "@/models/Settings";
import UserModel from "@/models/User";
import { BlogApiService } from "@/lib/blogApiService";

/** PUT /api/blogs/[id] — Update a blog */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await authenticate(req);
        const { id } = await params;
        const updates = await req.json();

        await connectDB();

        const blog = await BlogModel.findOne({ _id: id, createdBy: authUser._id });
        if (!blog) {
            return Response.json({ error: "Blog not found" }, { status: 404 });
        }

        // --- Monthly publish limit check ---
        if (updates.status === "PUBLISHED" && blog.status !== "PUBLISHED") {
            const user = await UserModel.findById(authUser._id).select("monthlyPublishLimit").lean<{ monthlyPublishLimit?: number }>();
            const limit = user?.monthlyPublishLimit ?? 0;

            if (limit > 0) {
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

                const publishedThisMonth = await BlogModel.countDocuments({
                    createdBy: authUser._id,
                    publishedAt: { $gte: monthStart, $lt: monthEnd },
                });

                if (publishedThisMonth >= limit) {
                    return Response.json(
                        {
                            error: `Monthly publish limit reached (${publishedThisMonth}/${limit}). Please contact your admin to increase your monthly limit.`,
                        },
                        { status: 403 }
                    );
                }
            }
        }

        Object.assign(blog, updates);
        await blog.save();

        // When publishing, send blog details to third-party API via admin-configured cURL
        if (updates.status === "PUBLISHED") {
            const settings = (await SettingsModel.findOne({ userId: authUser._id }).lean()) as { curlCommand?: string } | null;
            const curlCommand = settings?.curlCommand;
            if (curlCommand?.trim()) {
                const topic = await import("@/models/Topic").then(m => m.default.findById(blog.topicId).lean<{ postedBy?: string }>());
                const postedByValue = topic?.postedBy || "";

                const blogData: Record<string, unknown> = {
                    seoTitle: blog.seoTitle,
                    title: blog.seoTitle,
                    content: blog.content,
                    body: blog.content,
                    slug: blog.slug,
                    metaDescription: blog.metaDescription,
                    description: blog.metaDescription,
                    meta_description: blog.metaDescription,
                    tags: blog.tags,
                    featuredImageUrl: blog.featuredImageUrl,
                    featuredImagePrompt: blog.featuredImagePrompt,
                    publishedAt: blog.publishedAt,
                    topicId: blog.topicId?.toString(),
                    postedBy: postedByValue,
                    posted_by: postedByValue,
                    author: postedByValue,
                };
                try {
                    const apiResponse = await BlogApiService.postBlog(curlCommand, blogData);

                    // Save the publish API response directly via atomic update
                    // (avoids Mongoose Mixed-type change-detection & __v conflicts)
                    if (apiResponse != null && typeof apiResponse === "object") {
                        await BlogModel.findByIdAndUpdate(
                            blog._id,
                            { $set: { publishApiResponse: apiResponse } }
                        );
                        blog.publishApiResponse = apiResponse; // keep in-memory copy in sync
                    }
                } catch (apiError: any) {
                    console.error("Publish API call failed:", apiError.message);
                    // Blog is already marked PUBLISHED — don't fail the whole request
                }
            }
        }

        // Re-fetch the blog so the response includes publishApiResponse
        const updatedBlog = await BlogModel.findById(blog._id).lean();
        return Response.json({ blog: updatedBlog });
    } catch (error) {
        return authErrorResponse(error);
    }
}

/** DELETE /api/blogs/[id] — Delete (reject) a blog */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await authenticate(req);
        const { id } = await params;

        await connectDB();

        const blog = await BlogModel.findOne({ _id: id, createdBy: authUser._id });
        if (!blog) {
            return Response.json({ error: "Blog not found" }, { status: 404 });
        }

        // If blog was published, call the delete curl command configured for this user
        if (blog.status === "PUBLISHED") {
            const settings = (await SettingsModel.findOne({ userId: authUser._id }).lean()) as { deleteCurlCommand?: string } | null;
            const deleteCurlCommand = settings?.deleteCurlCommand;
            console.log("[DELETE Blog] Blog status:", blog.status);
            console.log("[DELETE Blog] publishApiResponse:", blog.publishApiResponse ? JSON.stringify(blog.publishApiResponse) : "EMPTY");
            console.log("[DELETE Blog] deleteCurlCommand:", deleteCurlCommand ? "CONFIGURED" : "NOT CONFIGURED");

            if (deleteCurlCommand?.trim()) {
                // Use publishApiResponse if available, otherwise fall back to blog fields
                // Deep-convert to plain JSON to strip BSON/ObjectId wrappers
                const rawParams = blog.publishApiResponse
                    ? (blog.publishApiResponse as Record<string, unknown>)
                    : { id: blog._id?.toString() };
                const deleteParams: Record<string, unknown> = JSON.parse(JSON.stringify(rawParams));
                console.log("[DELETE Blog] Using params:", JSON.stringify(deleteParams));
                try {
                    await BlogApiService.deleteBlog(deleteCurlCommand, deleteParams);
                    console.log("[DELETE Blog] External delete succeeded");
                } catch (deleteError: any) {
                    console.error("[DELETE Blog] External delete failed:", deleteError.message);
                    return Response.json(
                        { error: `Failed to delete from external API: ${deleteError.message}` },
                        { status: 500 }
                    );
                }
            }
        }

        blog.status = "REJECTED";
        blog.comments = "Deleted by user";
        await blog.save();

        return Response.json({ message: "Blog deleted" });
    } catch (error) {
        return authErrorResponse(error);
    }
}
