import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        content: { type: String, required: true },
        image: { type: String },
        type : { type: String, required: true, enum: ['Tech', 'Lifestyle', 'Education', 'Health', 'Travel'] },
        readingTime: { type: Number, required: true },
    });
const Blog = mongoose.model("Blog", blogSchema);

export default Blog;