import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/alexandria";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export const getDb = async () => {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri);
    global._mongoClientPromise = client.connect().then(() => client).catch((error) => {
      global._mongoClientPromise = undefined;
      throw error;
    });
  }
  const connectedClient = await global._mongoClientPromise;
  return connectedClient.db(process.env.MONGODB_DB ?? "alexandria");
};
