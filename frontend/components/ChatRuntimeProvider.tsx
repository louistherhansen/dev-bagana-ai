"use client";

import { useRef, useMemo, useState, createContext, useContext, useCallback, useEffect, useTransition } from "react";
import {
  useLocalRuntime,
  AssistantRuntimeProvider,
  useAuiState,
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ChatModelRunResult,
} from "@assistant-ui/react";
import {
  getConversation,
  saveConversation,
  createConversation,
  updateConversationMessages,
  type ChatMessage,
  type Conversation,
} from "@/lib/chatHistory";
import { createPlan, type ContentPlan } from "@/lib/contentPlans";
import { parseContentPlanMarkdown } from "@/lib/contentPlanSchema";
import { createSentimentAnalysis, parseSentimentComposition } from "@/lib/sentimentAnalysis";
import { createTrend } from "@/lib/trends";

/** Context for output language preference (multi-language chat). */
export const OutputLanguageContext = createContext<{
  language: string;
  setLanguage: (value: string) => void;
  options: { value: string; label: string }[];
}>({ language: "", setLanguage: () => {}, options: [] });

export function useOutputLanguage() {
  return useContext(OutputLanguageContext);
}


/** Context for agent progress tracking. */
export interface AgentResult {
  agent: string;
  task: string;
  output?: string;
  timestamp: string;
  startTime?: number; // Unix timestamp in milliseconds
  endTime?: number; // Unix timestamp in milliseconds
  duration?: number; // Duration in milliseconds
}

export type LastCrewRun = {
  /** Text that was rendered to the user (post-processed). */
  displayText: string;
  /** Text with headings (useful for Markdown export). */
  markdownText: string;
  /** Raw JSON from /api/crew (for JSON export/debug). */
  rawResponse: Record<string, any>;
  finishedAt: number; // Unix ms
};

export const AgentProgressContext = createContext<{
  currentAgent: string | null;
  completedAgents: string[];
  agentResults: AgentResult[];
  lastRun: LastCrewRun | null;
  setProgress: (agent: string | null) => void;
  addAgentResult: (result: AgentResult) => void;
  resetProgress: () => void;
  stopRun: () => void;
}>({
  currentAgent: null,
  completedAgents: [],
  agentResults: [],
  lastRun: null,
  setProgress: () => {},
  addAgentResult: () => {},
  resetProgress: () => {},
  stopRun: () => {},
});

export function useAgentProgress() {
  return useContext(AgentProgressContext);
}

/** Convert markdown formatting: ## menjadi angka berurutan, ** menjadi - */
function stripMarkdownHeadersAndBold(text: string): string {
  if (!text || typeof text !== "string") return text;
  
  let result = text;
  let sectionNumber = 1;
  
  // Replace ## (level 2 heading) dengan angka berurutan (1., 2., 3., dst)
  result = result.replace(/^##\s+(.+)$/gm, (match, content) => {
    const numbered = `${sectionNumber}. ${content}`;
    sectionNumber++;
    return numbered;
  });
  
  // Replace ### (level 3 heading) - hapus saja atau biarkan sebagai sub-section
  result = result.replace(/^###\s+(.+)$/gm, "$1");
  
  // Replace # (level 1 heading) - hapus saja
  result = result.replace(/^#\s+(.+)$/gm, "$1");
  
  // Replace ** dengan - (bold menjadi bullet)
  result = result.replace(/\*\*([^*]+)\*\*/g, "- $1");
  
  return result;
}

/**
 * Extract content plan from crew output and save to database
 */
async function extractAndSaveContentPlan(
  crewData: {
    task_outputs?: Array<{ task?: string; output?: string }>;
    output?: string;
  },
  conversationId: string | null
): Promise<void> {
  try {
    // Find content plan task output (MVP: create_content_plan)
    // Also check for legacy task names for backward compatibility
    const contentPlanTask = crewData.task_outputs?.find(
      (t) => t.task === "create_content_plan" || 
             t.task === "create_content_strategy" ||
             t.task?.includes("content_plan") || 
             t.task?.includes("content_strategy")
    );
    
    if (!contentPlanTask?.output) {
      console.log("No content plan output found, skipping plan extraction");
      return;
    }

    // Extract brand name from user input (from conversation)
    let brandName: string | undefined;
    let campaign: string | undefined;
    let talents: string[] = [];

    if (conversationId) {
      try {
        const conv = await getConversation(conversationId);
        if (conv) {
          // Extract brand name from first user message
          const firstUserMessage = conv.messages.find((m) => m.role === "user");
          if (firstUserMessage) {
            const text = firstUserMessage.content.find((c) => c.type === "text")?.text || "";
            
            // Extract brand name
            const brandMatch = text.match(/-?\s*Brand\s+Name:\s*([^\n\r]+)/i);
            if (brandMatch && brandMatch[1]) {
              brandName = brandMatch[1].trim().split(/[,\-–—]/)[0].trim();
            }
            
            // Extract campaign
            const campaignMatch = text.match(/-?\s*Campaign\s+Type:\s*([^\n\r]+)/i);
            if (campaignMatch && campaignMatch[1]) {
              campaign = campaignMatch[1].trim();
            }
          }
        }
      } catch (err) {
        console.error("Error loading conversation for plan extraction:", err);
      }
    }

    // Extract talents from content plan output
    // Look for patterns like "Talent 1", "Creator 1", etc.
    const talentPatterns = [
      /(?:Talent|Creator|Influencer|KOL)\s+(\d+):\s*([^\n]+)/gi,
      /-?\s*(?:Talent|Creator|Influencer|KOL):\s*([^\n]+)/gi,
    ];
    
    const foundTalents = new Set<string>();
    for (const pattern of talentPatterns) {
      const matches = Array.from(contentPlanTask.output.matchAll(pattern));
      for (const match of matches) {
        const talentName = match[2] || match[1];
        if (talentName) {
          foundTalents.add(talentName.trim());
        }
      }
    }
    talents = Array.from(foundTalents);

    // Generate plan ID
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract title from content plan (first heading or first line)
    const titleMatch = contentPlanTask.output.match(/^#+\s*(.+)$/m) || 
                      contentPlanTask.output.match(/^(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim().substring(0, 100) : 
                  (brandName ? `${brandName} Content Plan` : "Content Plan");

    // Create plan
    const parsedPlan = parseContentPlanMarkdown(contentPlanTask.output);

    // Fallbacks: brand/campaign often missing when conversationId is not available
    if (!brandName && parsedPlan.brandName) {
      brandName = parsedPlan.brandName;
    }
    if (!campaign && parsedPlan.campaignType) {
      campaign = parsedPlan.campaignType;
    }
    if ((!talents || talents.length === 0) && parsedPlan.talentAssignments?.length) {
      talents = parsedPlan.talentAssignments.map((t) => t.talent).filter(Boolean);
    }

    await createPlan({
      id: planId,
      title,
      campaign,
      brandName,
      conversationId: conversationId || undefined,
      schemaValid: true,
      talents: talents.length > 0 ? talents : [],
      version: "v1.0",
      content: {
        schemaVersion: "bagana.contentPlan.v1",
        extractedAt: parsedPlan.extractedAt,
        plan: parsedPlan,
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        source: "crew_output",
        taskOutputs: crewData.task_outputs?.map((t) => ({
          task: t.task,
          hasOutput: !!t.output,
        })),
      },
    });

    console.log("Content plan saved:", planId);
  } catch (error) {
    console.error("Error extracting and saving content plan:", error);
    // Don't throw - this is a background operation
  }
}

/**
 * Derive a short brand label from the last user message (e.g. first line or "Brand: X").
 */
function deriveBrandFromMessage(message: string | undefined): string | undefined {
  if (!message || typeof message !== "string") return undefined;
  const trimmed = message.trim();
  if (!trimmed) return undefined;
  // Prefer "Brand Name: X" or "Brand: X"
  const m = trimmed.match(/(?:Brand\s+Name|Brand)\s*[:\-]\s*([^\n\r,]+)/i);
  if (m?.[1]?.trim()) return m[1].trim().slice(0, 100);
  // Else use first line or first 50 chars
  const firstLine = trimmed.split(/[\n\r]/)[0]?.trim();
  if (firstLine) return firstLine.slice(0, 80);
  return trimmed.slice(0, 80) || undefined;
}

/** Extract sentiment section from combined crew output (fallback when task output is empty). */
function extractSentimentSectionFromCombined(combined: string): string | null {
  if (!combined || !combined.trim()) return null;
  // Try: ## Sentiment Analyst, ## analyze_sentiment, or block containing "Sentiment Composition (Pie Chart)"
  const markers = [
    /##\s*(?:Sentiment\s+Analyst|analyze_sentiment)[\s\S]*?(?=##\s*(?:Trend|Content|create_content|research_trends)|$)/i,
    /Sentiment Composition\s*\([^)]*\)[\s\S]*?(?=##\s*(?:Trend|Content|Key Market)|$)/i,
  ];
  for (const re of markers) {
    const m = combined.match(re);
    if (m && m[0].trim().length > 20) return m[0].trim();
  }
  return null;
}

/** Extract trend section from combined crew output (fallback when task output is empty). */
function extractTrendSectionFromCombined(combined: string): string | null {
  if (!combined || !combined.trim()) return null;
  const markers = [
    /##\s*(?:Trend\s+Researcher|research_trends|Key\s+Market\s+Trends)[\s\S]*$/i,
    /(?:Key\s+Market\s+Trends|Summary\s+Bar\s+Chart)[\s\S]*$/i,
  ];
  for (const re of markers) {
    const m = combined.match(re);
    if (m && m[0].trim().length > 20) return m[0].trim();
  }
  return null;
}

/**
 * Extract sentiment analysis from crew output (analyze_sentiment task) and save to database.
 * Parses "Sentiment Composition (Pie Chart): Positive X%, Neutral Y%, Negative Z%" for Pie Chart.
 * Fallback: if task output is empty, try to extract section from combined crew output.
 */
async function extractAndSaveSentimentAnalysis(
  crewData: {
    task_outputs?: Array<{ task?: string; agent?: string; output?: string }>;
    output?: string;
  },
  conversationId: string | null,
  getBrandNameFromConversation: (convId: string | null) => Promise<string | undefined>,
  lastUserMessage?: string
): Promise<void> {
  try {
    const list = crewData.task_outputs ?? [];
    const combinedOutput = typeof crewData.output === "string" ? crewData.output : "";
    console.log("Extracting sentiment from task_outputs:", list.map(t => ({ task: t.task, agent: t.agent, outputLen: (t.output ?? "").length })), "combinedLen:", combinedOutput.length);

    // Prefer fixed order: 3 tasks = [Content Plan, Sentiment, Trends] → use index 1 for sentiment
    let sentimentTask = list.length >= 2 ? list[1] : undefined;
    if (!sentimentTask || !(sentimentTask.output ?? "").trim()) {
      sentimentTask = list.find((t) => {
        const taskName = (t.task || "").toLowerCase();
        const agentName = (t.agent || "").toLowerCase();
        return (
          taskName === "analyze_sentiment" ||
          taskName.includes("sentiment") ||
          agentName.includes("sentiment")
        );
      });
    }

    let textToUse = (sentimentTask?.output ?? "").trim();
    if (!textToUse && combinedOutput) {
      const fallback = extractSentimentSectionFromCombined(combinedOutput);
      if (fallback) {
        textToUse = fallback;
        console.log("Using sentiment section from combined output, length:", textToUse.length);
      }
    }

    if (!textToUse) {
      console.warn("Sentiment: no task found or output empty; combined length:", combinedOutput.length);
      return;
    }

    console.log("Found sentiment content to save, length:", textToUse.length);

    const composition = parseSentimentComposition(textToUse);
    if (!composition) {
      console.warn("Failed to parse sentiment composition. Preview:", textToUse.substring(0, 200));
    }

    const positivePct = composition?.positivePct ?? 0;
    const neutralPct = composition?.neutralPct ?? 0;
    const negativePct = composition?.negativePct ?? 0;

    let brandName = await getBrandNameFromConversation(conversationId);
    if (!brandName || !brandName.trim()) {
      brandName = deriveBrandFromMessage(lastUserMessage) ?? "Unknown Brand";
    }

    console.log("Saving sentiment analysis for brand:", brandName, { positivePct, neutralPct, negativePct });

    await createSentimentAnalysis({
      brandName: brandName.trim(),
      positivePct,
      negativePct,
      neutralPct,
      fullOutput: textToUse,
      conversationId: conversationId ?? undefined,
    });
    console.log("✓ Sentiment analysis saved successfully for brand:", brandName);
  } catch (error) {
    console.error("Error extracting and saving sentiment analysis:", error);
    throw error;
  }
}

/**
 * Extract trend research from crew output (research_trends task) and save to database.
 * Fallback: if task output is empty, try to extract section from combined crew output.
 */
async function extractAndSaveTrends(
  crewData: {
    task_outputs?: Array<{ task?: string; agent?: string; output?: string }>;
    output?: string;
  },
  conversationId: string | null,
  getBrandNameFromConversation: (convId: string | null) => Promise<string | undefined>,
  lastUserMessage?: string
): Promise<void> {
  try {
    const list = crewData.task_outputs ?? [];
    const combinedOutput = typeof crewData.output === "string" ? crewData.output : "";
    console.log("Extracting trends from task_outputs:", list.map(t => ({ task: t.task, agent: t.agent, outputLen: (t.output ?? "").length })), "combinedLen:", combinedOutput.length);

    // Prefer fixed order: 3 tasks = [Content Plan, Sentiment, Trends] → use index 2 for trends
    let trendTask = list.length >= 3 ? list[2] : undefined;
    if (!trendTask || !(trendTask.output ?? "").trim()) {
      trendTask = list.find((t) => {
        const taskName = (t.task || "").toLowerCase();
        const agentName = (t.agent || "").toLowerCase();
        return (
          taskName === "research_trends" ||
          taskName.includes("trend") ||
          agentName.includes("trend")
        );
      });
    }

    let textToUse = (trendTask?.output ?? "").trim();
    if (!textToUse && combinedOutput) {
      const fallback = extractTrendSectionFromCombined(combinedOutput);
      if (fallback) {
        textToUse = fallback;
        console.log("Using trend section from combined output, length:", textToUse.length);
      }
    }

    if (!textToUse) {
      console.warn("Trends: no task found or output empty; combined length:", combinedOutput.length);
      return;
    }

    console.log("Found trend content to save, length:", textToUse.length);

    let brandName = await getBrandNameFromConversation(conversationId);
    if (!brandName || !brandName.trim()) {
      brandName = deriveBrandFromMessage(lastUserMessage) ?? "Unknown Brand";
    }

    console.log("Saving trend analysis for brand:", brandName);

    await createTrend({
      brandName: brandName.trim(),
      fullOutput: textToUse,
      conversationId: conversationId ?? undefined,
    });
    console.log("✓ Trend analysis saved successfully for brand:", brandName);
  } catch (error) {
    console.error("Error extracting and saving trend analysis:", error);
    throw error;
  }
}

// MVP: 3 core agents per PRD §3 and SAD §2
const AGENT_ORDER = [
  "Content Planner",
  "Sentiment Analyst",
  "Trend Researcher",
];

/** Resolve brand name from conversation (first user message). */
async function getBrandNameFromConversation(conversationId: string | null): Promise<string | undefined> {
  if (!conversationId) return undefined;
  try {
    const conv = await getConversation(conversationId);
    const firstUser = conv?.messages?.find((m) => m.role === "user");
    const text = firstUser?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
    const m = text.match(/-?\s*Brand\s+Name:\s*([^\n\r]+)/i);
    return m?.[1]?.trim()?.split(/[,\-–—]/)[0]?.trim();
  } catch {
    return undefined;
  }
}

/** Chat model adapter: wires assistant-ui chat to backend CrewAI API (POST /api/crew). */
/** Chat model adapter: wires assistant-ui chat to backend CrewAI API (POST /api/crew). */
function createCrewAdapter(
  getLanguage: () => string,
  setCurrentAgent: (agent: string | null) => void,
  setCompletedAgents: (agents: string[] | ((prev: string[]) => string[])) => void,
  addAgentResult: (result: AgentResult) => void,
  setAgentStartTime: (agent: string) => void,
  getAgentStartTime: (agent: string) => number | undefined,
  getConversationId: () => string | null,
  registerAbortController: (ctrl: AbortController | null) => void,
  setLastRun: (run: LastCrewRun | null) => void
): ChatModelAdapter {
  return {
    async run(options: ChatModelRunOptions): Promise<ChatModelRunResult> {
      const { messages, abortSignal } = options;
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
      const text = lastUserMessage?.content?.find((c) => c.type === "text");
      const message = typeof text === "object" && text && "text" in text ? String(text.text) : "";

      if (abortSignal.aborted) {
        setCurrentAgent(null);
        setCompletedAgents([]);
        return { content: [], status: { type: "incomplete" as const, reason: "cancelled" as const } };
      }

      // Reset progress & Inisialisasi Agent pertama
      setCompletedAgents([]);
      setLastRun(null);
      const firstAgent = AGENT_ORDER[0] || null;
      setCurrentAgent(firstAgent);
      if (firstAgent) setAgentStartTime(firstAgent);

      if (!message || message.trim().length === 0) {
        setCurrentAgent(null);
        return {
          content: [{ type: "text" as const, text: "Error: Message cannot be empty." }],
          status: { type: "complete" as const, reason: "stop" as const },
        };
      }

      const language = getLanguage();
      const body: Record<string, string> = { message: message.trim() };
      if (language) body.language = language;

      try {
        // Local abort controller so UI can stop the run.
        const ctrl = new AbortController();
        registerAbortController(ctrl);
        const onAbort = () => {
          try {
            ctrl.abort();
          } catch {
            /* ignore */
          }
        };
        if (abortSignal) {
          if (abortSignal.aborted) onAbort();
          abortSignal.addEventListener("abort", onAbort, { once: true });
        }

        // --- FIX: READ TOKEN FROM STORAGE ---
        // Ensure key "token" matches what's stored in localStorage
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

        const res = await fetch("/api/crew", {
          method: "POST",
          credentials: "include",
          headers: { 
            "Content-Type": "application/json",
            // Inject Authorization header if token exists
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        
        // Handle unauthorized (401)
        if (res.status === 401) {
          setCurrentAgent(null);
          let detail = "Your session has expired. Please sign in again to continue.";
          try {
            const errBody = await res.json();
            if (errBody?.error && typeof errBody.error === "string") {
              detail = `${detail}\n\n(${errBody.error.slice(0, 400)})`;
            }
          } catch {
            /* ignore */
          }
          return {
            content: [{ type: "text" as const, text: detail }],
            status: { type: "complete" as const, reason: "stop" as const },
          };
        }

        // Parse response data (read body exactly once to avoid "body stream already read")
        const rawText = await res.text();
        let data: Record<string, any>;
        try {
          if (!rawText || !rawText.trim()) {
            data = {};
          } else {
            const parsed = JSON.parse(rawText);
            data =
              parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? (parsed as Record<string, any>)
                : ({ value: parsed } as Record<string, any>);
          }
        } catch {
          throw new Error(
            `Failed to parse response (${res.status}): ${rawText.slice(0, 200)}`
          );
        }

        if (!res.ok) {
          throw new Error(data.error || data.message || `Server Error ${res.status}`);
        }

        // --- PROSES DATA HASIL CREW ---
        console.log("[Crew Adapter] Received data:", {
          status: data.status,
          hasOutput: !!data.output,
          outputLength: data.output?.length || 0,
          taskOutputsCount: Array.isArray(data.task_outputs) ? data.task_outputs.length : 0,
          taskOutputs: data.task_outputs
        });
        
        const rawTaskOutputs = Array.isArray(data.task_outputs) ? data.task_outputs : [];
        const taskOutputs = rawTaskOutputs.map((t: any) => ({
          task: (t.task ?? t.task_name ?? "Task") as string,
          agent: (t.agent ?? "") as string,
          output: (t.output ?? t.result ?? "") as string,
        }));

        const mainOutput = data.output ? String(data.output) : "";
        let outText = mainOutput;

        if (taskOutputs.length > 0) {
          console.log("[Crew Adapter] Processing task outputs:", taskOutputs.map(t => ({
            task: t.task,
            agent: t.agent,
            outputLength: t.output.length
          })));
          
          const taskSection = taskOutputs
            .map((t: any) => `## ${t.agent || t.task}\n\n${stripMarkdownHeadersAndBold(t.output)}`)
            .join("\n\n---\n\n");
          outText = mainOutput ? `${mainOutput}\n\n---\n\n${taskSection}` : taskSection;
        }

        console.log("[Crew Adapter] Final output text length:", outText.length);

        // Background Saving to DB
        const convId = getConversationId();
        if (data.status === "complete") {
          console.log("[Crew Adapter] Starting background save operations...");
          Promise.allSettled([
            extractAndSaveContentPlan(data, convId),
            extractAndSaveSentimentAnalysis(data, convId, getBrandNameFromConversation, message),
            extractAndSaveTrends(data, convId, getBrandNameFromConversation, message),
          ]).then((results) => {
            // Log hasil untuk debugging
            const successCount = results.filter(r => r.status === "fulfilled").length;
            const failureCount = results.filter(r => r.status === "rejected").length;
            console.log(`[Crew Save] Completed: ${successCount} succeeded, ${failureCount} failed`);
            
            // Log detail untuk setiap operasi
            results.forEach((result, index) => {
              const operationNames = ["ContentPlan", "SentimentAnalysis", "Trends"];
              if (result.status === "fulfilled") {
                console.log(`[Crew Save] ✓ ${operationNames[index]} saved successfully`);
              } else {
                console.error(`[Crew Save] ✗ ${operationNames[index]} failed:`, result.reason);
              }
            });
            
            // Dispatch event untuk trigger refresh di Content Plans, Sentiment Analysis, dan Trends views
            // Event ini akan memicu refresh di semua views yang mendengarkan
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("crew-save-done", {
                detail: {
                  successCount,
                  failureCount,
                  timestamp: Date.now()
                }
              }));
              console.log("[Crew Save] Dispatched crew-save-done event");
            }
          }).catch((error) => {
            console.error("Error in crew save operations:", error);
            // Tetap dispatch event meskipun ada error, agar UI bisa refresh
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("crew-save-done", {
                detail: { error: error.message, timestamp: Date.now() }
              }));
            }
          });
        }

        setCurrentAgent(null);
        setCompletedAgents([...AGENT_ORDER]);
        registerAbortController(null);

        const displayText = stripMarkdownHeadersAndBold(outText);
        setLastRun({
          displayText,
          markdownText: outText,
          rawResponse: data,
          finishedAt: Date.now(),
        });

        return {
          content: [{ type: "text" as const, text: displayText }],
          status: { type: "complete" as const, reason: "stop" as const },
        };

      } catch (err: any) {
        if (err?.name === "AbortError") {
          setCurrentAgent(null);
          registerAbortController(null);
          return {
            content: [{ type: "text" as const, text: "Dibatalkan." }],
            status: { type: "complete" as const, reason: "stop" as const },
          };
        }
        console.error("Crew Adapter Error:", err);
        setCurrentAgent(null);
        registerAbortController(null);
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          status: { type: "complete" as const, reason: "stop" as const },
        };
      }
    },
  };
}

const OUTPUT_LANGUAGE_OPTIONS = [
  { value: "", label: "Same as message" },
  { value: "Bahasa Indonesia", label: "Bahasa Indonesia" },
  { value: "English", label: "English" },
  { value: "日本語", label: "日本語" },
  { value: "中文", label: "中文" },
  { value: "Español", label: "Español" },
  { value: "Français", label: "Français" },
];

export function ChatRuntimeProvider({ children }: { children: React.ReactNode }) {
  const [outputLanguage, setOutputLanguage] = useState("English");
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [agentResults, setAgentResults] = useState<AgentResult[]>([]);
  const [lastRun, setLastRun] = useState<LastCrewRun | null>(null);
  const agentStartTimes = useRef<Map<string, number>>(new Map());
  const languageRef = useRef(outputLanguage);
  const conversationIdRef = useRef<string | null>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);

  languageRef.current = outputLanguage;

  const getAgentStartTime = useCallback((agent: string): number | undefined => {
    return agentStartTimes.current.get(agent);
  }, []);

  const addAgentResult = useCallback((result: AgentResult) => {
    setAgentResults((prev) => {
      // Update existing result or add new one
      const existingIndex = prev.findIndex(
        (r) => r.agent === result.agent && r.task === result.task
      );
      
      // Calculate duration if start time exists
      let finalResult = { ...result };
      if (result.startTime && result.endTime) {
        finalResult.duration = result.endTime - result.startTime;
      } else {
        const startTime = agentStartTimes.current.get(result.agent);
        if (startTime) {
          const endTime = Date.now();
          finalResult.startTime = startTime;
          finalResult.endTime = endTime;
          finalResult.duration = endTime - startTime;
          // Don't delete - keep for reference
        }
      }
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = finalResult;
        return updated;
      }
      return [...prev, finalResult];
    });
  }, []);
  
  const setAgentStartTime = useCallback((agent: string) => {
    agentStartTimes.current.set(agent, Date.now());
  }, []);

  const crewAdapter = useMemo(
    () => createCrewAdapter(
      () => languageRef.current, 
      setCurrentAgent, 
      setCompletedAgents,
      addAgentResult,
      setAgentStartTime,
      getAgentStartTime,
      () => conversationIdRef.current,
      (ctrl) => {
        abortCtrlRef.current = ctrl;
      },
      setLastRun
    ),
    [addAgentResult, setAgentStartTime, getAgentStartTime]
  );

  const initialMessages = useMemo(() => [
    {
      id: "welcome",
      role: "assistant" as const,
      content: [
        {
          type: "text" as const,
          text: "Welcome to BAGANA AI. I'll help you create multi-talent content plans with sentiment analysis and trend insights. Share your campaign context or a brief to get started.",
        },
      ],
    },
  ], []);

  const runtime = useLocalRuntime(crewAdapter, {
    initialMessages,
  });

  // Sync thread/conversation id so save-to-database can link plans/sentiment/trends to this chat
  useEffect(() => {
    try {
      const r = runtime as { threadList?: { mainItem?: { getState?: () => { id?: string } } } };
      const id = r?.threadList?.mainItem?.getState?.()?.id;
      if (id && typeof id === "string") {
        conversationIdRef.current = id;
      }
    } catch {
      // ignore
    }
  }, [runtime]);

  const languageContextValue = useMemo(
    () => ({
      language: outputLanguage,
      setLanguage: setOutputLanguage,
      options: OUTPUT_LANGUAGE_OPTIONS,
    }),
    [outputLanguage]
  );

  const progressContextValue = useMemo(
    () => ({
      currentAgent,
      completedAgents,
      agentResults,
      lastRun,
      setProgress: setCurrentAgent,
      addAgentResult,
      resetProgress: () => {
        setCurrentAgent(null);
        setCompletedAgents([]);
        setAgentResults([]);
        setLastRun(null);
      },
      stopRun: () => {
        try {
          abortCtrlRef.current?.abort();
        } catch {
          /* ignore */
        }
      },
    }),
    [currentAgent, completedAgents, agentResults, lastRun, addAgentResult]
  );

  return (
    <OutputLanguageContext.Provider value={languageContextValue}>
      <AgentProgressContext.Provider value={progressContextValue}>
        <AssistantRuntimeProvider runtime={runtime}>
          {children}
        </AssistantRuntimeProvider>
      </AgentProgressContext.Provider>
    </OutputLanguageContext.Provider>
  );
}
