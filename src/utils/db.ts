import mongoose from "mongoose";

export const connection = mongoose.createConnection(process.env.MONGO_URL);
