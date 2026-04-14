"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { useAgentProgress, type AgentResult } from "@/components/ChatRuntimeProvider";
import { createProject, deleteProject, getActiveProjectId, listProjects, setActiveProjectId, type Project } from "@/lib/projects";

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function autosizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  // Reset height so scrollHeight reflects current content
  el.style.height = "0px";
  const next = Math.min(el.scrollHeight, 220); // cap so composer doesn't overtake screen
  el.style.height = `${Math.max(next, 44)}px`;
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl bg-bagana-primary px-4 py-3 text-white">
        <MessagePrimitive.Parts
          components={{
            Text: ({ text }) => (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
            ),
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  const isRunning = useAuiState(({ thread }) => thread.isRunning);
  const { completedAgents } = useAgentProgress();
  const shouldAnimate = !isRunning && completedAgents.length > 0;

  return (
    <MessagePrimitive.Root className="flex justify-start">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <MessagePrimitive.Parts
          components={{
            Text: ({ text }) => <AnimatedAssistantText text={text} animate={shouldAnimate} />,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function AnimatedAssistantText({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(() => (animate ? "" : text));

  useEffect(() => {
    if (!animate) {
      setShown(text);
      return;
    }
    // Typewriter effect
    const full = text ?? "";
    if (!full) {
      setShown("");
      return;
    }
    // If short, just show instantly
    if (full.length < 80) {
      setShown(full);
      return;
    }
    let i = 0;
    setShown("");
    const tick = () => {
      i = Math.min(full.length, i + Math.max(2, Math.floor(full.length / 300)));
      setShown(full.slice(0, i));
      if (i >= full.length) return;
      raf = window.setTimeout(tick, 16);
    };
    let raf = window.setTimeout(tick, 16);
    return () => window.clearTimeout(raf);
  }, [text, animate]);

  return <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-800">{shown}</p>;
}

// MVP: 3 core agents per PRD §3 and SAD §2
const AGENT_NAMES = [
  "Content Planner",
  "Sentiment Analyst",
  "Trend Researcher",
];

function AgentProgress({ 
  currentAgent, 
  completedAgents = [], 
  agentResults = [] 
}: { 
  currentAgent: string | null; 
  completedAgents?: string[];
  agentResults?: AgentResult[];
}) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [runningDurations, setRunningDurations] = useState<Map<string, number>>(new Map());

  // Update running durations for active agents
  useEffect(() => {
    if (!currentAgent) return;
    
    const interval = setInterval(() => {
      const startTime = Date.now() - 1000; // Approximate, will be updated when agent completes
      setRunningDurations((prev) => {
        const next = new Map(prev);
        const agentResult = agentResults.find((r) => r.agent === currentAgent);
        if (agentResult?.startTime) {
          const duration = Date.now() - agentResult.startTime;
          next.set(currentAgent, duration);
        } else {
          // Fallback: estimate based on when agent started
          const existing = next.get(currentAgent) || 0;
          next.set(currentAgent, existing + 1000);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentAgent, agentResults]);

  const toggleAgent = (agent: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) {
        next.delete(agent);
      } else {
        next.add(agent);
      }
      return next;
    });
  };

  const getAgentResult = (agent: string): AgentResult | undefined => {
    return agentResults.find((r) => r.agent === agent);
  };

  const formatDuration = (ms: number | undefined): string => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getAgentDuration = (agent: string, isActive: boolean, isCompleted: boolean): number | undefined => {
    if (isCompleted) {
      const result = getAgentResult(agent);
      return result?.duration;
    }
    if (isActive) {
      return runningDurations.get(agent);
    }
    return undefined;
  };

  // Show initial loading state
  if (!currentAgent && completedAgents.length === 0) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-3">
          <div
            className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 border-t-bagana-primary animate-spin"
            aria-hidden
          />
          <span className="text-slate-600 text-sm font-medium">BAGANA AI Starting...</span>
        </div>
      </div>
    );
  }

  // Check if all agents are completed (MVP: 3 agents)
  const allCompleted = completedAgents.length >= AGENT_NAMES.length && !currentAgent;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 w-full">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {allCompleted ? (
              <>
                <div className="h-5 w-5 shrink-0 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-slate-700 text-sm font-semibold text-green-700">
                  ✓ All Agents Completed
                </span>
              </>
            ) : (
              <>
                <div
                  className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 border-t-bagana-primary animate-spin"
                  aria-hidden
                />
                <span className="text-slate-700 text-sm font-semibold">
                  {currentAgent ? `Processing with ${currentAgent}...` : completedAgents.length > 0 ? "Finalizing results..." : "Starting crew..."}
                </span>
              </>
            )}
          </div>
          <div className="space-y-2 pl-8">
            {AGENT_NAMES.map((agent) => {
              const isActive = agent === currentAgent;
              const isCompleted = completedAgents.includes(agent);
              const agentResult = getAgentResult(agent);
              const isExpanded = expandedAgents.has(agent);
              const duration = getAgentDuration(agent, isActive, isCompleted);
              
              return (
                <div key={agent} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => isCompleted && toggleAgent(agent)}
                    disabled={!isCompleted}
                    className={`w-full flex items-center gap-2 text-xs px-3 py-2 text-left transition-colors ${
                      isCompleted ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-bagana-primary border-t-transparent animate-spin shrink-0" />
                        <span className="font-medium text-bagana-primary flex-1">{agent}</span>
                        <span className="text-slate-500">Running...</span>
                        {duration && (
                          <span className="text-bagana-primary font-mono text-[10px]">
                            {formatDuration(duration)}
                          </span>
                        )}
                      </>
                    ) : isCompleted ? (
                      <>
                        <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-slate-700 font-medium flex-1">{agent}</span>
                        <span className="text-green-600 font-semibold">✓ Completed</span>
                        {duration && (
                          <span className="text-slate-500 font-mono text-[10px]">
                            {formatDuration(duration)}
                          </span>
                        )}
                        {agentResult && (
                          <svg 
                            className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-slate-300 shrink-0" />
                        <span className="text-slate-400 flex-1">{agent}</span>
                        <span className="text-slate-400">Pending</span>
                      </>
                    )}
                  </button>
                  
                  {/* Accordion content untuk hasil agent */}
                  {isCompleted && agentResult && isExpanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-slate-200 bg-white">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <div>
                          <span className="font-medium">Task:</span> {agentResult.task}
                        </div>
                        {agentResult.duration && (
                          <div className="text-slate-400 font-mono">
                            ⏱️ {formatDuration(agentResult.duration)}
                          </div>
                        )}
                      </div>
                      {agentResult.startTime && agentResult.endTime && (
                        <div className="text-xs text-slate-400 mb-2">
                          <span className="font-medium">Time:</span> {new Date(agentResult.startTime).toLocaleTimeString('en-US')} - {new Date(agentResult.endTime).toLocaleTimeString('en-US')}
                        </div>
                      )}
                      {agentResult.output && (
                        <div className="text-xs text-slate-700 bg-slate-50 rounded p-2 max-h-60 overflow-y-auto">
                          <pre className="whitespace-pre-wrap font-sans">{agentResult.output}</pre>
                        </div>
                      )}
                      {!agentResult.output && (
                        <div className="text-xs text-slate-400 italic">
                          Execution results will be displayed here...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatRunningIndicator() {
  const isRunning = useAuiState(({ thread }) => thread.isRunning);
  const { currentAgent, completedAgents, agentResults } = useAgentProgress();

  if (!isRunning && completedAgents.length === 0) return null;

  return <AgentProgress currentAgent={currentAgent} completedAgents={completedAgents} agentResults={agentResults} />;
}

function SidePanel() {
  const isRunning = useAuiState(({ thread }) => thread.isRunning);
  const { currentAgent, completedAgents, agentResults, lastRun, stopRun } = useAgentProgress();

  return (
    <div className="h-full flex flex-col min-h-0 rounded-2xl border border-slate-200 bg-white">
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800">Agent Panel</div>
          <div className="text-xs text-slate-500 truncate">
            {isRunning ? (currentAgent ? `Running: ${currentAgent}` : "Running…") : (lastRun ? "Ready" : "Idle")}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => stopRun()}
            disabled={!isRunning}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Stop
          </button>
          <button
            type="button"
            onClick={() => {
              if (!lastRun) return;
              downloadTextFile(`bagana-run-${new Date(lastRun.finishedAt).toISOString()}.md`, lastRun.markdownText, "text/markdown;charset=utf-8");
            }}
            disabled={!lastRun}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Export .md
          </button>
          <button
            type="button"
            onClick={() => {
              if (!lastRun) return;
              downloadTextFile(
                `bagana-run-${new Date(lastRun.finishedAt).toISOString()}.json`,
                JSON.stringify(lastRun.rawResponse, null, 2),
                "application/json;charset=utf-8"
              );
            }}
            disabled={!lastRun}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Export .json
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Steps</div>
          <div className="mt-2 space-y-2">
            {AGENT_NAMES.map((a) => {
              const isActive = isRunning && a === currentAgent;
              const isDone = completedAgents.includes(a);
              return (
                <div key={a} className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isDone ? "bg-emerald-500" : isActive ? "bg-bagana-primary animate-pulse" : "bg-slate-300"
                    }`}
                    aria-hidden
                  />
                  <span className={`${isActive ? "font-semibold text-bagana-primary" : isDone ? "text-slate-800" : "text-slate-500"}`}>
                    {a}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {lastRun && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Last run</div>
            <div className="mt-2 text-xs text-slate-500">
              Finished: {new Date(lastRun.finishedAt).toLocaleString()}
            </div>
            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 whitespace-pre-wrap">
              {lastRun.displayText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TemplateFormData {
  brand_name: string;
  company_type: string;
  product_type: string;
  website: string;
  campaign_type: string;
}

function CampaignTemplateForm({ onMessageSubmit }: { onMessageSubmit: (message: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>({
    brand_name: "",
    company_type: "",
    product_type: "",
    website: "",
    campaign_type: "",
  });

  const handleInputChange = (field: keyof TemplateFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    // Validasi required fields
    if (!formData.brand_name || !formData.company_type || !formData.product_type || !formData.campaign_type) {
      alert("Please fill in all required fields (Brand Name, Company Type, Product Type, Campaign Type)");
      return;
    }

    // Format message sebagai brand input yang sesuai dengan task description
    // Task mengharapkan: brand, product information, campaign context, user requirements
    const messageParts: string[] = [];
    
    messageParts.push(`Brand Information:`);
    messageParts.push(`- Brand Name: ${formData.brand_name}`);
    messageParts.push(`- Company Type: ${formData.company_type}`);
    if (formData.website) {
      messageParts.push(`- Website: ${formData.website}`);
    }
    
    messageParts.push(`\nProduct Information:`);
    messageParts.push(`- Product Type: ${formData.product_type}`);
    
    messageParts.push(`\nCampaign Context:`);
    messageParts.push(`- Campaign Type: ${formData.campaign_type}`);
    
    messageParts.push(`\nPlease create a comprehensive content plan based on the above brand and campaign information.`);

    const message = messageParts.join("\n");

    // Use callback to submit message through Composer
    onMessageSubmit(message);

    // Reset form
    setFormData({
      brand_name: "",
      company_type: "",
      product_type: "",
      website: "",
      campaign_type: "",
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    setFormData({
      brand_name: "",
      company_type: "",
      product_type: "",
      website: "",
      campaign_type: "",
    });
  };

  return (
    <div className="mb-4 border border-slate-200 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700">
          📋 Campaign Template
        </span>
        <span className="text-slate-500 text-sm">
          {isOpen ? "▼" : "▶"}
        </span>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="brand_name" className="block text-xs font-medium text-slate-700 mb-1">
                Brand Name *
              </label>
              <input
                id="brand_name"
                type="text"
                value={formData.brand_name}
                onChange={(e) => handleInputChange("brand_name", e.target.value)}
                placeholder="e.g., Nike, Apple"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              />
            </div>

            <div>
              <label htmlFor="company_type" className="block text-xs font-medium text-slate-700 mb-1">
                Company Type *
              </label>
              <input
                id="company_type"
                type="text"
                value={formData.company_type}
                onChange={(e) => handleInputChange("company_type", e.target.value)}
                placeholder="e.g., Technology, Fashion, F&B"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              />
            </div>

            <div>
              <label htmlFor="product_type" className="block text-xs font-medium text-slate-700 mb-1">
                Product Type *
              </label>
              <input
                id="product_type"
                type="text"
                value={formData.product_type}
                onChange={(e) => handleInputChange("product_type", e.target.value)}
                placeholder="e.g., Smartphone, Shoes, Beverage"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              />
            </div>

            <div>
              <label htmlFor="website" className="block text-xs font-medium text-slate-700 mb-1">
                Website (Optional)
              </label>
              <input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              />
              <p className="text-xs text-slate-500 mt-1">Website brand (opsional, untuk referensi)</p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="campaign_type" className="block text-xs font-medium text-slate-700 mb-1">
                Campaign Type *
              </label>
              <select
                id="campaign_type"
                value={formData.campaign_type}
                onChange={(e) => handleInputChange("campaign_type", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              >
                <option value="">Select campaign type...</option>
                <option value="Product Launch">Product Launch</option>
                <option value="Brand Awareness">Brand Awareness</option>
                <option value="Seasonal Campaign">Seasonal Campaign</option>
                <option value="Influencer Collaboration">Influencer Collaboration</option>
                <option value="Social Media Campaign">Social Media Campaign</option>
                <option value="Event Promotion">Event Promotion</option>
                <option value="Content Series">Content Series</option>
                <option value="Rebranding Campaign">Rebranding Campaign</option>
                <option value="User Acquisition">User Acquisition</option>
                <option value="Retention Campaign">Retention Campaign</option>
                <option value="Other">Other</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Jenis kampanye konten yang akan dibuat</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSubmit}
              disabled={!formData.brand_name || !formData.company_type || !formData.product_type || !formData.campaign_type}
              className="flex-1 rounded-lg bg-bagana-primary px-4 py-2 text-sm font-medium text-white hover:bg-bagana-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit to Chat
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => getActiveProjectId());
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listProjects();
      setProjects(list);
      // If activeId is missing, auto-select first project
      const current = getActiveProjectId();
      if (!current && list[0]?.id) {
        setActiveProjectId(list[0].id);
        setActiveId(list[0].id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load projects";
      setError(msg);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSelect = (id: string) => {
    setActiveProjectId(id);
    setActiveId(id);
  };

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const p = await createProject(trimmed);
      setName("");
      await refresh();
      onSelect(p.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteProject(id);
      const next = projects.filter((p) => p.id !== id);
      setProjects(next);
      if (activeId === id) {
        const fallback = next[0]?.id ?? null;
        setActiveProjectId(fallback);
        setActiveId(fallback);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-slate-200">
        <div className="text-sm font-semibold text-slate-800">Projects</div>
        <div className="text-xs text-slate-500">Saved in the database</div>
      </div>

      <div className="p-3 border-b border-slate-200">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
          />
          <button
            type="button"
            onClick={onCreate}
            className="rounded-lg bg-bagana-primary px-3 py-2 text-sm font-medium text-white hover:bg-bagana-secondary"
          >
            Add
          </button>
        </div>
        {error && <div className="mt-2 text-xs text-red-600 whitespace-pre-wrap">{error}</div>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {loading ? (
          <div className="p-3 text-sm text-slate-500">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="p-3 text-sm text-slate-500">No projects yet. Create one to get started.</div>
        ) : (
          <div className="space-y-1">
            {projects.map((p) => {
              const active = p.id === activeId;
              return (
                <div
                  key={p.id}
                  className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    active ? "border-bagana-primary bg-bagana-primary/5" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <button type="button" onClick={() => onSelect(p.id)} className="flex-1 text-left min-w-0">
                    <div className="font-medium text-slate-800 truncate">{p.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{p.id}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(p.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-slate-500 hover:text-red-600"
                    aria-label={`Delete project ${p.name}`}
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatInterface() {
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  
  /**
   * Function to submit message programmatically (used by Campaign Template Form)
   * 
   * Ada 2 cara mengirim pesan di aplikasi ini:
   * 1. Chat langsung: User mengetik di ComposerPrimitive.Input dan klik ComposerPrimitive.Send
   * 2. Template chat: User mengisi form CampaignTemplateForm dan submit otomatis mengirim pesan
   * 
   * Fungsi ini digunakan untuk cara ke-2 (template chat)
   * 
   * Note: We use DOM manipulation as the primary method since assistant-ui's runtime API
   * may not be accessible directly from useAuiState in all cases.
   */
  const submitMessageProgrammatically = useCallback((message: string) => {
    try {
      // Validate message
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        console.warn('Cannot submit empty message');
        return;
      }
      
      console.log('Submitting message programmatically:', message);
      console.log('Input ref available:', !!composerInputRef.current);
      
      // Primary method: DOM manipulation (most reliable)
      // Set input value and trigger submit button
      if (composerInputRef.current) {
        console.log('Using DOM manipulation method');
        const input = composerInputRef.current;
        
        // Focus the input first
        input.focus();
        
        // Clear any existing value
        input.value = '';
        
        // Set the new value
        input.value = message;
        
        // Use React's synthetic event system by creating a proper input event
        // First, try to get the native input element
        const nativeInput = input as HTMLInputElement | HTMLTextAreaElement;
        
        // Dispatch input event so React/assistant-ui sees the value change
        // (Avoid nativeValueSetter.call() — causes "Illegal invocation" in some browsers)
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        nativeInput.dispatchEvent(inputEvent);
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        nativeInput.dispatchEvent(changeEvent);

        // Make sure textarea height matches the inserted template text
        autosizeTextarea(input);
        
        // Wait for Composer to update its state, then submit
        setTimeout(() => {
          // Find the Send button - try multiple methods
          let sendButton: HTMLButtonElement | null = null;
          
          // Method 1: Find within the ComposerPrimitive.Root
          const composerRoot = input.closest('[class*="max-w-4xl"]') || input.closest('form');
          if (composerRoot) {
            sendButton = composerRoot.querySelector('button[type="submit"]') as HTMLButtonElement;
          }
          
          // Method 2: Try data attribute
          if (!sendButton) {
            sendButton = document.querySelector('[data-composer="send"]') as HTMLButtonElement;
          }
          
          // Method 3: Find by text content within Composer area
          if (!sendButton) {
            const composerArea = input.closest('div[class*="flex"]');
            if (composerArea) {
              const buttons = Array.from(composerArea.querySelectorAll('button'));
              sendButton = buttons.find(btn => 
                btn.textContent?.trim() === 'Send' || 
                btn.textContent?.includes('Send')
              ) as HTMLButtonElement || null;
            }
          }
          
          // Method 4: Global search as last resort
          if (!sendButton) {
            const buttons = Array.from(document.querySelectorAll('button'));
            sendButton = buttons.find(btn => 
              (btn.textContent?.trim() === 'Send' || 
               btn.textContent?.includes('Send')) &&
              !btn.disabled &&
              btn.offsetParent !== null // Button is visible
            ) as HTMLButtonElement || null;
          }
          
          if (sendButton && !sendButton.disabled) {
            console.log('Clicking send button:', sendButton);
            sendButton.focus();
            sendButton.click();
          } else {
            console.warn('Send button not found or disabled. Available buttons:', 
              Array.from(document.querySelectorAll('button')).map(b => ({
                text: b.textContent,
                disabled: b.disabled,
                type: b.type
              }))
            );
            // Last resort: try to submit the form
            const form = input.closest('form');
            if (form) {
              console.log('Trying to submit form');
              form.requestSubmit();
            }
          }
        }, 500); // Increased delay to ensure state is updated
        return;
      }
      
      console.warn('Unable to submit message: input ref not available');
    } catch (error) {
      console.error('Error submitting message:', error);
      // Show user-friendly error message
      if (error instanceof Error) {
        alert(`Error sending message: ${error.message}`);
      } else {
        alert('Error sending message. Please try again.');
      }
    }
  }, []); // No dependencies needed since we use refs inside

  return (
    <div className="flex-1 min-h-0 w-full">
      <ThreadPrimitive.Root className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[280px,minmax(0,1fr),420px] gap-4">
        {/* LEFT: Projects */}
        <div className="min-h-0 hidden lg:block">
          <ProjectsPanel />
        </div>
        {/* LEFT: Chat */}
        <div className="min-h-0 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <ThreadPrimitive.Viewport className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="space-y-6">
              <ThreadPrimitive.Messages
                components={{
                  UserMessage,
                  AssistantMessage,
                }}
              />
              <ChatRunningIndicator />
            </div>
          </ThreadPrimitive.Viewport>

          <div className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
            <ComposerPrimitive.Root>
              <div className="flex flex-col gap-2 sm:gap-3">
                <CampaignTemplateForm onMessageSubmit={submitMessageProgrammatically} />

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <ComposerPrimitive.Input
                    ref={composerInputRef}
                    placeholder="Type 'ping' to test the connection — or send a campaign brief (crew takes 1–2 minutes)"
                    onInput={(e) => autosizeTextarea(e.currentTarget as HTMLTextAreaElement)}
                    className="flex-1 min-h-[44px] resize-none overflow-hidden rounded-xl border border-slate-300 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-bagana-primary focus:outline-none focus:ring-2 focus:ring-bagana-primary/20"
                  />
                  <ComposerPrimitive.Send className="rounded-xl bg-bagana-primary px-5 py-3 text-sm font-medium text-white hover:bg-bagana-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-target shrink-0">
                    Send
                  </ComposerPrimitive.Send>
                </div>

                {/* Output language control removed (keep default in provider) */}
              </div>
            </ComposerPrimitive.Root>
          </div>
        </div>

        {/* RIGHT: Agent panel */}
        <div className="min-h-0 hidden lg:block">
          <SidePanel />
        </div>
      </ThreadPrimitive.Root>
    </div>
  );
}
