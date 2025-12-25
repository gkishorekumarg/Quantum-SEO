import { GoogleGenAI, Type, Modality, GenerateContentResponse, Part, FunctionDeclaration, Tool } from "@google/genai";
import { ResearchResult, TopicIdea, CompetitorInfo, InternalLink, RankedKeyword, EeatSource } from "../types";
import { callWebhookTool } from "./webhook";

// Define recommended models based on task complexity
const PRIMARY_MODEL = 'gemini-3-pro-preview';
const FALLBACK_MODEL = 'gemini-3-flash-preview';

// Validation helper
function getApiKey() {
    const key = process.env.API_KEY;
    if (!key || key === 'undefined' || key === '') {
        console.error("CRITICAL: API_KEY is missing. Ensure it is set in Vercel Environment Variables.");
        throw new Error("Gemini API Key is missing. Please check your deployment settings.");
    }
    return key;
}

// Helper to extract JSON from a string that might contain markdown fences or extra text
function extractJson(text: string): string {
    if (!text) return "[]";
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) return match[1].trim();
    
    const firstOpen = text.search(/[{\[]/);
    if (firstOpen !== -1) {
        const lastIndex = text.lastIndexOf(text[firstOpen] === '{' ? '}' : ']');
        if (lastIndex !== -1) {
            return text.substring(firstOpen, lastIndex + 1);
        }
    }
    return text.trim();
}

function isQuotaError(error: any): boolean {
    if (error) console.warn("Checking error for quota/server:", error);
    const status = error.status || error.code;
    return status === 429 || status === 503 || status === 500 || 
           status === 'RESOURCE_EXHAUSTED' || status === 'PERMISSION_DENIED' ||
           (error.message && (
               error.message.includes('429') || error.message.includes('quota') || 
               error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('Too Many Requests')
           ));
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

async function withModelFallback<T>(
    primaryFn: (model: string) => Promise<T>,
    fallbackFn: (model: string) => Promise<T> = primaryFn
): Promise<T> {
    try {
        return await withRetry(() => primaryFn(PRIMARY_MODEL), 1, 1000);
    } catch (error: any) {
        if (isQuotaError(error)) {
            return await withRetry(() => fallbackFn(FALLBACK_MODEL), 3, 2000);
        }
        throw error;
    }
}

export async function generateTopicIdeas(theme: string): Promise<TopicIdea[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate 5 blog topic ideas for theme '${theme}'. criteria: Answer-First, High Utility, Data Potential. Respond with a valid JSON array of {title, description}.`,
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

export async function generateTopicIdeasFromScrape(scrapedData: { content: string, title: string, description: string }, websiteUrl: string, language: string): Promise<TopicIdea[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: `
                I have scraped the following content from '${websiteUrl}':
                Title: ${scrapedData.title}
                Description: ${scrapedData.description}
                Content Snippet: ${scrapedData.content.substring(0, 5000)}

                Based on this existing content, identify 5 new, high-value blog topic ideas that would fill "Topical Gaps" and help build SEO authority for this site.
                The ideas must be in '${language}'.
                Respond with a valid JSON array: [{"title": "...", "description": "..."}]
            `,
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

export async function generateTopicIdeasForWebsite(websiteUrl: string, country: string, language: string): Promise<TopicIdea[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze website '${websiteUrl}'. Generate 5 blog topic ideas for '${country}' market in '${language}' that help build "Topical Authority". Respond with valid JSON array of {title, description}.`,
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

export async function analyzeCompetitors(topic: string): Promise<{ competitors: Omit<CompetitorInfo, 'url'>[], groundingLinks: CompetitorInfo[] }> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: `For topic '${topic}', analyze top 3 competitors via Google Search. Identify: main argument, content gaps, structure. Respond with valid JSON object: { competitors: [{title, summary}] }.`,
            config: { 
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        competitors: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    summary: { type: Type.STRING }
                                },
                                required: ["title", "summary"]
                            }
                        }
                    },
                    required: ["competitors"]
                }
            },
        });

        const parsedData = JSON.parse(extractJson(response.text || "{}"));
        const competitors = (parsedData.competitors || []).map((c: any) => ({
            title: String(c.title || 'Competitor Analysis'),
            summary: typeof c.summary === 'string' ? c.summary : JSON.stringify(c.summary)
        }));
        
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const groundingLinks: CompetitorInfo[] = groundingChunks
            .map(chunk => ({
                title: chunk.web?.title ?? 'Unknown Source',
                url: chunk.web?.uri ?? '#',
                summary: '' 
            }))
            .filter(link => link.url !== '#');

        return { competitors, groundingLinks };
    });
}

export async function findEeatSources(topic: string): Promise<EeatSource[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: `Find 3 authoritative, non-commercial sources for topic "${topic}". Respond with valid JSON array: [{title, url, summary}].`,
            config: { 
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            url: { type: Type.STRING },
                            summary: { type: Type.STRING }
                        },
                        required: ["title", "url", "summary"]
                    }
                }
            },
        });
        const parsed = JSON.parse(extractJson(response.text || "[]"));
        return Array.isArray(parsed) ? parsed.map((s: any) => ({
            title: s.title || "Source",
            url: s.url || "#",
            summary: typeof s.summary === 'object' ? JSON.stringify(s.summary) : String(s.summary || "")
        })) : [];
    });
}

export async function generateKeywordStrategy(
    topic: string,
    rankedKeywords: RankedKeyword[],
    callWebhook: (func: 'suggested_keywords', params: { keyword: string }) => Promise<any[]>
): Promise<string[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const seedResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Identify 3 high-volume seed keywords (max 2 words) for topic: "${topic}". Respond with JSON array of strings.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        });
        let seeds: string[] = JSON.parse(extractJson(seedResponse.text || "[]"));

        let allSuggestions: any[] = [];
        if (seeds.length > 0) {
             const results = await Promise.all(seeds.slice(0, 3).map(seed => callWebhook('suggested_keywords', { keyword: seed }).catch(() => [])));
             allSuggestions = results.flat();
        }

        const finalKeywordsResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Select 10 target keywords for topic: "${topic}". Data: ${JSON.stringify(allSuggestions.slice(0, 30))}. Respond with JSON array of strings.`,
            config: { 
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
        });
        return JSON.parse(extractJson(finalKeywordsResponse.text || "[]"));
    });
}

export async function generateOutlineSuggestions(topic: string): Promise<string[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Suggest 3 structural approaches for topic "${topic}" using Inverted Pyramid model. Respond with JSON array of 3 strings.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function selectRelevantInternalLinks(topic: string, allLinks: InternalLink[]): Promise<InternalLink[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Select 3-5 internal links for topic "${topic}". List: ${JSON.stringify(allLinks)}. Respond with JSON array of {title, url}.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: { title: { type: Type.STRING }, url: { type: Type.STRING } },
                        required: ["title", "url"]
                    }
                }
            }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function generateOutline(topic: string, keywords: string[], competitors: Omit<CompetitorInfo, 'url'>[], internalLinks: InternalLink[]): Promise<string[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: `Create detailed GEO-optimized outline for '${topic}'. Keywords: ${keywords.join(', ')}. Respond with JSON array of strings.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function refineOutlineWithAI(currentOutline: string, topic: string, keywords: string[], competitors: Omit<CompetitorInfo, 'url'>[], internalLinks: InternalLink[]): Promise<string[]> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: `Refine this outline for topic '${topic}': ${currentOutline}. Ensure Answer-First and E-E-A-T. Respond with JSON array of strings.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        });
        return JSON.parse(extractJson(response.text || "[]"));
    });
}

export async function generateLongFormContent(prompt: string, internalLinks: InternalLink[]) {
    return await withModelFallback(async (model) => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const textPrompt = `${prompt}. Integration: ${internalLinks.map(l => `- ${l.title} (${l.url})`).join('\n')}. Use standard Markdown. Start with # Title. Stream now.`;
        return await ai.models.generateContentStream({ model: model, contents: textPrompt });
    });
}

export async function reviewArticle(draft: string): Promise<string> {
    return await withModelFallback(async (model) => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: model,
            contents: `Clean and polish this Markdown draft, removing AI filler and fixing headers: ${draft}`,
        });
        return (response.text || "").trim();
    });
}

export async function generateContextualAddition(prevContext: string, nextContext: string, type: 'TEXT' | 'IMAGE' | 'GRAPH' | 'TABLE'): Promise<string> {
    return await withModelFallback(async (model) => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: model,
            contents: `Connect these contexts: Before: ${prevContext.slice(-200)} After: ${nextContext.slice(0, 200)}. Type: ${type}.`,
        });
        let result = (response.text || "").trim();
        if (type === 'IMAGE') return `[IMAGE: ${result}]`;
        if (type === 'GRAPH') return `[GRAPH: ${result}]`;
        return result;
    });
}

export async function chatWithDraft(currentDraft: string, chatHistory: { role: 'user' | 'model'; text: string }[], userMessage: string, appState: { websiteUrl: string, country: string, language: string }): Promise<string> {
    return await withModelFallback(async (model) => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const chat = ai.chats.create({
            model: model,
            config: {
                tools: [{ googleSearch: {} }],
                systemInstruction: `You are an expert Content Editor assistant for this draft: ${currentDraft.substring(0, 5000)}.`
            },
            history: chatHistory.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
        });
        const result = await chat.sendMessage({ message: userMessage });
        return result.text || "";
    });
}

export async function generateArticleImage(prompt: string): Promise<string> {
    const tryNanoBanana = async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: `${prompt} . Authentic editorial photography, 35mm film style.` }] },
        });
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
        }
        throw new Error("No image data.");
    };
    return await withRetry(tryNanoBanana, 1, 1000);
}

export async function editArticleImage(base64Image: string, mimeType: string, prompt: string): Promise<string> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ inlineData: { data: base64Image, mimeType } }, { text: prompt }] },
        });
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
        }
        throw new Error("No image data.");
    });
}

export async function transformText(text: string, action: string, language: string): Promise<string> {
    return await withModelFallback(async (model) => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: model,
            contents: `Action: ${action}, Language: ${language}. Text: ${text}. Return ONLY rewritten text.`,
        });
        return (response.text || "").trim();
    });
}

export async function regenerateTitle(articleContent: string): Promise<string> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate a click-worthy headline for: ${articleContent.substring(0, 1000)}`,
        });
        return (response.text || "").trim();
    });
}

export async function generateSpeech(text: string, voice: string): Promise<string> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
        });
        const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!data) throw new Error("No audio.");
        return data;
    });
}

export async function generateSocialPosts(text: string): Promise<Record<string, string>> {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Create social posts for: ${text}. Return JSON: {twitter, linkedin, reddit, instagram, facebook}.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        twitter: { type: Type.STRING },
                        linkedin: { type: Type.STRING },
                        reddit: { type: Type.STRING },
                        instagram: { type: Type.STRING },
                        facebook: { type: Type.STRING },
                    },
                    required: ["twitter", "linkedin", "reddit", "instagram", "facebook"]
                }
            }
        });
        return JSON.parse(extractJson(response.text || "{}"));
    });
}