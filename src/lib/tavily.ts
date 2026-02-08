import { tavily } from "@tavily/core";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export default client;
