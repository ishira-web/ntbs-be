// /server/routes/blog.routes.js
import { Router } from "express";
import { uploadBlogImage } from "../configs/multer-campaign.js";
import {
  createBlog,
  getBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
} from "../controllers/Blog.controller.js";

const router = Router();

// List + Create
router.get("/", getBlogs);
router.post("/", uploadBlogImage.single("image"), createBlog);

// One
router.get("/:id", getBlogById);

// Update (image optional, field name: "image")
router.put("/:id", uploadBlogImage.single("image"), updateBlog);
router.patch("/:id", uploadBlogImage.single("image"), updateBlog);

// Delete
router.delete("/:id", deleteBlog);

export default router;
