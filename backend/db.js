import dns from "node:dns";
import mongoose from "mongoose";

// Fix for Windows DNS resolution with mongodb+srv SRV records
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // If setServers fails in restricted environments, ignore
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not defined in .env file.");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
}
