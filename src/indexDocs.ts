import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
});

const pinecone = new PineconeClient();

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);

const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex,
  maxConcurrency: 5,
});

export default async function prepareDoc(filePath: string) {
  const loader = new PDFLoader(filePath, {
    splitPages: false,
  });
  const singleDoc = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  if (!singleDoc[0]) {
    throw new Error("No document content found");
  }
  const texts = await textSplitter.splitText(singleDoc[0].pageContent);

  const documents = texts.map((chunk) => {
    return {
      pageContent: chunk,
      metadata: singleDoc[0]?.metadata ?? {},
    };
  });

  await vectorStore.addDocuments(documents);

  console.log("Done ✅");
}

prepareDoc("./codersgyan_courses.pdf");
