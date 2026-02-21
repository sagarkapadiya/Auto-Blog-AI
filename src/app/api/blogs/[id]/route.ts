import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { authenticate, authErrorResponse } from "@/lib/auth";
import BlogModel from "@/models/Blog";
import SettingsModel from "@/models/Settings";
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

        Object.assign(blog, updates);
        await blog.save();

        // When publishing, send blog details to third-party API via admin-configured cURL
        if (updates.status === "PUBLISHED") {
            const settings = (await SettingsModel.findOne({ userId: authUser._id }).lean()) as { curlCommand?: string } | null;
            const curlCommand = settings?.curlCommand;
            if (curlCommand?.trim()) {
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
                };
                await BlogApiService.postBlog(curlCommand, blogData);
            }
        }

        return Response.json({ blog });
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

        blog.status = "REJECTED";
        blog.comments = "Deleted by user";
        await blog.save();

        return Response.json({ message: "Blog deleted" });
    } catch (error) {
        return authErrorResponse(error);
    }
}
