import { attachDatabasePool } from "@vercel/functions";
import { MongoClient } from "mongodb";

type MongoGlobal = typeof globalThis & {
  __mattoMongoClientPromise?: Promise<MongoClient>;
};

const mongoGlobal = globalThis as MongoGlobal;

export async function getMongoDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_NOT_CONFIGURED");
  }

  if (!mongoGlobal.__mattoMongoClientPromise) {
    const client = new MongoClient(uri, {
      appName: "matto-chales",
      maxIdleTimeMS: 10_000,
    });

    attachDatabasePool(client);
    mongoGlobal.__mattoMongoClientPromise = client.connect();
  }

  const client = await mongoGlobal.__mattoMongoClientPromise;
  return client.db(process.env.MONGODB_DB || "matto-chales");
}
