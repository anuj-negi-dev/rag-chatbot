import { tool } from "@langchain/core/tools";
import { createRetrieverTool } from "langchain/tools/retriever";
import { vectorStore } from "./indexDocs";

export const getOffers = tool(
  () => {
    return JSON.stringify([
      {
        code: "LAUNCH_10`",
        discount_percent: 10,
      },
      {
        code: "SUMMER_15",
        discount_percent: 15,
      },
      {
        code: "VIP_20",
        discount_percent: 20,
      },
    ]);
  },
  {
    name: "offers_query_tool",
    description: "Call this tool to get the available offer and discounts",
  }
);

const retriever = vectorStore.asRetriever();

export const kbRetriever = createRetrieverTool(retriever, {
  name: "retrieve_learning_knowledge_base",
  description:
    "Call this tool to get the knowledge about the course and syllabus",
});
