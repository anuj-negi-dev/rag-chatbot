import { END, StateGraph } from "@langchain/langgraph";
import { StateAnnotation } from "./state";
import { model } from "./model";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { getOffers } from "./tools";
import type { AIMessage } from "@langchain/core/messages";

const marketingTools = [getOffers];
const marketingToolNode = new ToolNode(marketingTools);

async function frontDeskSupport(state: typeof StateAnnotation.State) {
  const SYSTEM_PROMPT = `You are frontline support staff for Coder's Gyan, an ed-tech company that helps software developers excel in their careers through practical web development and Generative AI Courses.
    Be concise in your responses.
    You can chat with students and help them with their basic queries, but if the query is related to marketing and learning, don't try to answer it. 
    Instead, immediately handover them to the marketing(promo codes, discounts, offers) or learning team(course curriculum, course content, course duration, etc), by asking the user hold for a moment.
    Otherwise, just answer the query directly.
    `;

  const supportResponse = await model.invoke([
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...state.messages,
  ]);

  const CATEGORIZATION_SYSTEM_PROMPT = `You are an expert customer support routing system.
  Your job is to detect whether a customer support representative is routing a user to a marketing team or learning support team, or if they are just responding conversationally`;

  const CATEGORIZATION_HUMAN_PROMPT = `The previous conversation is an interaction between a customer support representative and a user.
  Extract whether the representative is routing the user to a marketing team or a customer support team, or whether they are just responding conversationally.
  Respond with and JSON object having a single key "nextRepresentative" with one of the following values
  If they want to route the user to the marketing team, respond with "MARKETING"
  If they want to route the user to the learning team, respond with "LEARNING"
  Otherwise respond with "RESPOND"
  `;

  const categorizationResponse = await model.invoke(
    [
      {
        role: "system",
        content: CATEGORIZATION_SYSTEM_PROMPT,
      },
      ...state.messages,
      supportResponse,
      {
        role: "user",
        content: CATEGORIZATION_HUMAN_PROMPT,
      },
    ],
    {
      response_format: {
        type: "json_object",
      },
    }
  );

  const categorizationOutput = JSON.parse(
    categorizationResponse.content as string
  );

  return {
    messages: [supportResponse],
    nextRepresentative: categorizationOutput.nextRepresentative,
  };
}

async function marketingSupport(state: typeof StateAnnotation.State) {
  const llmWithTools = model.bindTools(marketingTools);

  const SYSTEM_PROMPT = `You are part of the marketing team of Coder's Gyan, an ed-tech company that helps software developers excel in their careers through practical web development and Generative AI Courses.
  You are specialize in handling question like promo codes, discounts, offers, etc.
  Answer clearly and concisely, and in a friendly manner.
  For any query related to the outside of marketing, politely inform the user that you are part of the marketing team and cannot help with that query and redirect the user to appropriate team like for curriculum, course content, course duration, etc. We have learning team for that.
  Important: Answer only using given context, else say I don't have enough information to answer.
  `;

  let trimmedHistory = state.messages;

  if (trimmedHistory.at(-1)?.getType() === "ai") {
    trimmedHistory = trimmedHistory.slice(0, -1);
  }

  const marketingResponse = await llmWithTools.invoke([
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...trimmedHistory,
  ]);

  return {
    messages: [marketingResponse],
  };
}

function learningSupport(state: typeof StateAnnotation.State) {
  console.log("Handling by marketing team");
  return state;
}

function whoIsNext(state: typeof StateAnnotation.State) {
  if (state.nextRepresentative.includes("MARKETING")) return "marketingSupport";
  else if (state.nextRepresentative.includes("LEARNING"))
    return "learningSupport";
  else return "__end__";
}

function isMarketingToolNext(state: typeof StateAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  if (lastMessage.tool_calls?.length) {
    return "marketingTools";
  }
  return "__end__";
}

const workflow = new StateGraph(StateAnnotation)
  .addNode("frontDeskSupport", frontDeskSupport)
  .addNode("marketingSupport", marketingSupport)
  .addNode("learningSupport", learningSupport)
  .addNode("marketingTools", marketingToolNode)
  .addEdge("__start__", "frontDeskSupport")
  .addConditionalEdges("frontDeskSupport", whoIsNext, {
    marketingSupport: "marketingSupport",
    learningSupport: "learningSupport",
    __end__: "__end__",
  })
  .addConditionalEdges("marketingSupport", isMarketingToolNext, {
    marketingTools: "marketingTools",
    __end__: END,
  })
  .addEdge("marketingTools", "marketingSupport")
  .addEdge("learningSupport", "__end__");

const app = workflow.compile();

async function main() {
  const stream = await app.stream({
    messages: [
      {
        role: "user",
        content: "Hi, can i get a discount cupon codes",
      },
    ],
  });
  for await (const value of stream) {
    console.log("------ STEP -------");
    console.log(value);
    console.log("------ STEP -------");
  }
}

main();
