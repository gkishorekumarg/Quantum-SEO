
import { AppState, InternalLink, RankedKeyword } from '../types';

// In a production environment, this would point to your custom Node.js/Python server or n8n instance
const WEBHOOK_URL: string = 'https://n8n.srv1196493.hstgr.cloud/webhook/quantum-seo-content-engine';

interface WebhookPayload {
    function: 'url_map' | 'url_scrape' | 'page_ranked_keywords' | 'suggested_keywords' | 'save_project';
    projectId?: string;
    url?: string;
    country?: string;
    language?: string;
    keyword?: string;
    data?: any; // For saving snapshots
}

/**
 * Save current app state to your external database via webhook
 */
export async function saveProjectToDb(appState: AppState): Promise<{ success: boolean, projectId: string }> {
    return callWebhookTool('save_project', appState, { data: appState });
}

export async function callWebhookTool(
    func: WebhookPayload['function'],
    appState: Pick<AppState, 'websiteUrl' | 'country' | 'language' | 'projectId'>,
    extraParams?: { url?: string; keyword?: string; data?: any }
): Promise<any> {
    if (!WEBHOOK_URL || WEBHOOK_URL === 'YOUR-WEBHOOK-URL') {
        console.warn("Webhook URL not configured.");
        if (func === 'url_map' || func === 'page_ranked_keywords') return [];
        return null;
    }

    const payload: WebhookPayload = {
        function: func,
        projectId: appState.projectId,
        url: extraParams?.url || appState.websiteUrl,
        country: appState.country,
        language: appState.language,
        ...extraParams
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        
        const responseText = await response.text();
        if (!responseText) return func === 'url_map' || func === 'page_ranked_keywords' ? [] : null;
        
        const responseData = JSON.parse(responseText);
        // Handle both raw objects and single-item arrays from n8n
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;

        // --- Custom parsers for specific SEO tools ---

        // 1. Firecrawl / URL Map parsing
        if (func === 'url_map') {
            const links = data?.internal_links || data?.links || data?.data?.[0]?.links;
            return Array.isArray(links) ? links.map((item: any) => ({
                url: item.url || item.loc || (typeof item === 'string' ? item : ''),
                title: item.title || (item.url || item.loc || '').split('/').pop()?.replace(/-/g, ' ') || 'Untitled'
            })).filter((l: any) => l.url) : [];
        }

        // 2. Firecrawl / Scrape parsing
        if (func === 'url_scrape') {
            const content = data?.markdown || data?.text || data?.data?.markdown || data?.data?.text || data?.content;
            const metadata = data?.metadata || data?.data?.metadata || {};
            return {
                content: typeof content === 'string' ? content : JSON.stringify(content),
                title: metadata.title || metadata.ogTitle || 'Scraped Content',
                description: metadata.description || metadata.ogDescription || ''
            };
        }
        
        // 3. SEO Keyword data parsing
        if (func === 'page_ranked_keywords') {
            const keywords = data?.ranked_keywords || (Array.isArray(data) ? data : []);
            return Array.isArray(keywords) ? keywords.map((kw: any) => ({
                keyword: kw.Keyword || kw.keyword || '',
                search_volume: kw.search_volume || kw.volume || 0,
                difficulty: kw.keyword_difficulty || kw.difficulty || 0,
                competition_level: kw.competition_level || kw.competition || 'LOW',
            })) : [];
        }

        return data;

    } catch (error: any) {
        console.error(`Webhook Error [${func}]:`, error);
        // CRITICAL FIX: Return empty arrays for expected list types to avoid length access errors
        if (func === 'url_map' || func === 'page_ranked_keywords') return [];
        return null;
    }
}
