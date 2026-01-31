import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/alexandria";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const client = new MongoClient(uri);
const clientPromise =
  global._mongoClientPromise ?? client.connect().then(() => client);

global._mongoClientPromise = clientPromise;

export const getDb = async () => {
  const connectedClient = await clientPromise;
  return connectedClient.db("alexandria");
};
