import { StateGraph } from "@langchain/langgraph";
import { StateAnnotation } from "./state";
import { model } from "./model";

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

function marketingSupport(state: typeof StateAnnotation.State) {
  console.log("Handling by marketing team");
  return state;
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

const workflow = new StateGraph(StateAnnotation)
  .addNode("frontDeskSupport", frontDeskSupport)
  .addNode("marketingSupport", marketingSupport)
  .addNode("learningSupport", learningSupport)
  .addEdge("__start__", "frontDeskSupport")
  .addConditionalEdges("frontDeskSupport", whoIsNext, {
    marketingSupport: "marketingSupport",
    learningSupport: "learningSupport",
    __end__: "__end__",
  })
  .addEdge("marketingSupport", "__end__")
  .addEdge("learningSupport", "__end__");

const app = workflow.compile();

async function main() {
  const stream = await app.stream({
    messages: [
      {
        role: "user",
        content:
          "Hi, i have 1 year of experince of react, suggest me a course according to that",
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
