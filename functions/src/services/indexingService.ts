import * as admin from "firebase-admin";
import {GeminiService} from "./geminiService";
import * as fs from "fs";
import * as path from "path";
import {glob} from "glob";

const db = admin.firestore();

const getFileContent = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

export const indexProjectFiles = async (): Promise<void> => {
  const geminiService = new GeminiService();
  const model = geminiService.getGenerativeModel("gemini-pro");
  const codeEmbeddingsCollection = db.collection("code_embeddings");

  const files = await glob("{src,functions/src}/**/*.{ts,tsx}");

  for (const file of files) {
    const filePath = path.resolve(file);
    const content = await getFileContent(filePath);

    const result = await model.embedContent(content);
    const embedding = result.embedding;

    await codeEmbeddingsCollection.doc(filePath).set({
      filePath,
      embedding,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
};
