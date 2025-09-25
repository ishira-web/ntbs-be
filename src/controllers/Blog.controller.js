import Blog from "../models/Blog.js";
import { cloudinary } from "../configs/multer-campaign.js";

function guessPublicIdFromUrl(url) {
  try {
    if (!url) return null;
    const u = new URL(url);
   
    const afterUpload = u.pathname.split("/image/upload/")[1]; 
    if (!afterUpload) return null;
    const parts = afterUpload.split("/").filter(Boolean);
  
    const noVersion = parts[0].startsWith("v") ? parts.slice(1) : parts;
    const last = noVersion.pop(); 
    const withoutExt = last.replace(/\.[^/.]+$/, "");
    return [...noVersion, withoutExt].join("/"); 
  } catch {
    return null;
  }
}

/** Create blog (multipart/form-data, field: image) */
export const createBlog = async (req, res) => {
  try {
    const { title, description, content, type, readingTime } = req.body;

    if (!title || !description || !content || !type || !readingTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const imageUrl = req.file?.path || undefined; // multer-storage-cloudinary sets .path to secure_url
    const blog = await Blog.create({
      title,
      description,
      content,
      type,
      readingTime,
      image: imageUrl,
    });

    res.status(201).json({ message: "Blog created", data: blog });
  } catch (err) {
    console.error("createBlog error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/** List blogs with pagination + optional search & type filter */
export const getBlogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 100);
    const skip = (page - 1) * limit;

    const { q, type } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { content: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Blog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Blog.countDocuments(filter),
    ]);

    res.json({ data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("getBlogs error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/** Get one blog */
export const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json({ data: blog });
  } catch (err) {
    console.error("getBlogById error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/** Update blog (supports replacing image) */
export const updateBlog = async (req, res) => {
  try {
    const { title, description, content, type, readingTime } = req.body;
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (typeof title !== "undefined") blog.title = title;
    if (typeof description !== "undefined") blog.description = description;
    if (typeof content !== "undefined") blog.content = content;
    if (typeof type !== "undefined") blog.type = type;
    if (typeof readingTime !== "undefined") blog.readingTime = readingTime;

    // If a new image uploaded, replace and cleanup old from Cloudinary (best-effort)
    if (req.file?.path) {
      const oldUrl = blog.image;
      blog.image = req.file.path; // new secure_url

      // Try delete old asset
      const oldPublicId = guessPublicIdFromUrl(oldUrl);
      if (oldPublicId) {
        try { await cloudinary.uploader.destroy(oldPublicId); } catch (e) { console.warn("Cloudinary delete failed:", e?.message || e); }
      }
    }

    await blog.save();
    res.json({ message: "Blog updated", data: blog });
  } catch (err) {
    console.error("updateBlog error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/** Delete blog (also best-effort delete Cloudinary image) */
export const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const publicId = guessPublicIdFromUrl(blog.image);
    if (publicId) {
      try { await cloudinary.uploader.destroy(publicId); } catch (e) { console.warn("Cloudinary delete failed:", e?.message || e); }
    }

    await blog.deleteOne();
    res.json({ message: "Blog deleted" });
  } catch (err) {
    console.error("deleteBlog error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
