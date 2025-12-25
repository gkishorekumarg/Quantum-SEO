import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { TopicIdea, CompetitorInfo, InternalLink, RankedKeyword, EeatSource } from "../types";
import { callWebhookTool } from "./webhook";

// Define recommended models
const PRIMARY_MODEL = 'gemini-3-pro-preview';
const FALLBACK_MODEL = 'gemini-3-flash-preview';

/**
 * Senior Engineer Note:
 * In Vite, variables must be prefixed with VITE_ to be exposed to the client.
 * Access them via import.meta.env.VITE_VARIABLE_NAME
 */
function getApiKey() {
    const key = import.meta.env.VITE_API_KEY;
    if (!key) {
        console.error("CRITICAL: VITE_API_KEY is missing in environment.");
        throw new Error("API Key Missing! Ensure you have 'VITE_API_KEY' set in Vercel Settings and have RE-DEPLOYED.");
    }
    return key;
}

// Helper to extract JSON from a string
function extractJson(text: string): string {
    if (!text) return "[]";
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) return match[1].trim();
    const firstOpen = text.search(/[{\[]/);
    if (firstOpen !== -1) {
        const lastIndex = text.lastIndexOf(text[firstOpen] === '{' ? '}' : ']');
        if (lastIndex !== -1) return text.substring(firstOpen, lastIndex + 1);
    }
    return text.trim();
}

function isQuotaError(error: any): boolean {
    const status = error.status || error.code;
    return status === 429 || status === 503 || status === 500 || 
           (error.message && (error.message.includes('429') || error.message.includes('quota')));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0 && isQuotaError(error)) {
            await new Promise(resolve => setTimeout(resolve, baseDelay));
            return withRetry(fn, retries - 1, baseDelay * 2);
        }
        throw error;
    }
}

export async function generateTopicIdeas(theme: string): Promise<TopicIdea[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate 5 blog topic ideas for '${theme}'. Respond with valid JSON array: [{"title": "...", "description": "..."}]`,
            config: { 
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING }
                        },
                        required: ["title", "description"]
                    }
                }
            },
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

// ... rest of the service functions follow the same pattern ...
// Note: Keeping functions minimal for the solution block as requested.

export async function generateTopicIdeasFromScrape(scrapedData: any, websiteUrl: string, language: string): Promise<TopicIdea[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: `Analyze: ${JSON.stringify(scrapedData)}. Suggest 5 topics in ${language}. JSON format.`,
            config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function generateTopicIdeasForWebsite(websiteUrl: string, country: string, language: string): Promise<TopicIdea[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze ${websiteUrl} for ${country} in ${language}. 5 ideas. JSON.`,
            config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function analyzeCompetitors(topic: string): Promise<{ competitors: any[], groundingLinks: any[] }> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: `Analyze top 3 competitors for '${topic}'. JSON: { competitors: [{title, summary}] }`,
            config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(extractJson(response.text || "{}"));
        const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => ({ title: c.web?.title, url: c.web?.uri })) || [];
        return { competitors: parsed.competitors || [], groundingLinks: links };
    });
}

export async function findEeatSources(topic: string): Promise<EeatSource[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: `Find 3 expert sources for '${topic}'. JSON: [{title, url, summary}]`,
            config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function generateKeywordStrategy(topic: string, ranked: any[], callWebhook: any): Promise<string[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Target keywords for '${topic}'. JSON array of strings.`,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function generateOutlineSuggestions(topic: string): Promise<string[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `3 structural approaches for '${topic}'. JSON string array.`,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function selectRelevantInternalLinks(topic: string, links: any[]): Promise<InternalLink[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Select 3 links from ${JSON.stringify(links)} for '${topic}'. JSON.`,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function generateOutline(topic: string, keywords: string[], competitors: any[], links: any[]): Promise<string[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: `Create outline for '${topic}'. Keywords: ${keywords.join(',')}. JSON string array.`,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function refineOutlineWithAI(outline: string, topic: string, keywords: string[], competitors: any[], links: any[]): Promise<string[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: `Refine outline for '${topic}': ${outline}. JSON string array.`,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function generateLongFormContent(prompt: string, links: any[]) {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    return await ai.models.generateContentStream({ 
        model: 'gemini-3-flash-preview', 
        contents: `${prompt}. Integrate: ${JSON.stringify(links)}` 
    });
}

export async function reviewArticle(draft: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: `Polish this article: ${draft}`,
    });
    return response.text || "";
}

export async function generateContextualAddition(prev: string, next: string, type: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Add ${type} between ${prev} and ${next}`,
    });
    return response.text || "";
}

export async function chatWithDraft(draft: string, history: any[], msg: string, state: any): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const chat = ai.chats.create({
        model: PRIMARY_MODEL,
        history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });
    const result = await chat.sendMessage({ message: msg });
    return result.text || "";
}

export async function generateArticleImage(prompt: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part) throw new Error("No image generated.");
    return `data:image/png;base64,${part.inlineData.data}`;
}

export async function editArticleImage(base64: string, mime: string, prompt: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ inlineData: { data: base64, mimeType: mime } }, { text: prompt }] },
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part) throw new Error("No image generated.");
    return `data:image/png;base64,${part.inlineData.data}`;
}

export async function transformText(text: string, action: string, lang: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${action} this in ${lang}: ${text}`,
    });
    return response.text || "";
}

export async function regenerateTitle(content: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `New title for: ${content.substring(0, 1000)}`,
    });
    return response.text || "";
}

export async function generateSpeech(text: string, voice: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
}

export async function generateSocialPosts(text: string): Promise<Record<string, string>> {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Social posts for: ${text}. JSON: {twitter, linkedin, reddit, instagram, facebook}`,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(extractJson(response.text || "{}"));
}