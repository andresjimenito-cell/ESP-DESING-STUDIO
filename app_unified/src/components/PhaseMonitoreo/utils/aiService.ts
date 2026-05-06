import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../constants";

export const getApiKey = () => GEMINI_API_KEY;

export const genAI = new GoogleGenerativeAI(getApiKey());
