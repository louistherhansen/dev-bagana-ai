"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconSparkles,
  IconHeart,
  IconTrending,
  IconClipboard,
  IconCheck,
  IconAlertTriangle,
  IconArrowRight,
} from "@/components/icons";

type OptimizationSuggestion = {
  id: string;
  type: "sentiment" | "trend" | "engagement";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  currentMessaging?: string;
  suggestedMessaging: string;
  rationale: string;
  expectedImpact: string;
  relatedPlanId?: string;
  relatedSentimentId?: string;
  relatedTrendId?: string;
};

const MOCK_SUGGESTIONS: OptimizationSuggestion[] = [
  {
    id: "opt-1",
    type: "sentiment",
    priority: "high",
    title: "Improve Positive Tone in Q1 Campaign",
    description: "Current messaging shows neutral sentiment. Optimize for more positive emotional connection.",
    currentMessaging: "Learn how to create better content with our platform.",
    suggestedMessaging: "Transform your content creation journey and unlock your creative potential with our innovative platform.",
    rationale: "Sentiment analysis shows audience responds 40% better to positive, empowering language. Current tone is neutral (0.2 sentiment score).",
    expectedImpact: "Expected 25-30% increase in engagement rate based on similar campaigns.",
    relatedPlanId: "plan-1",
    relatedSentimentId: "sentiment-1",
  },
  {
    id: "opt-2",
    type: "trend",
    priority: "high",
    title: "Incorporate Short-Form Video Trend",
    description: "Trend analysis shows short-form video content is trending. Update messaging to highlight this capability.",
    currentMessaging: "Create professional content for your brand.",
    suggestedMessaging: "Create viral-ready short-form video content that captures attention in seconds.",
    rationale: "Trend data shows 300% increase in short-form video engagement. Audience is 5x more likely to engage with video-first messaging.",
    expectedImpact: "Expected 50-60% increase in click-through rate and brand awareness.",
    relatedPlanId: "plan-1",
    relatedTrendId: "trend-1",
  },
  {
    id: "opt-3",
    type: "engagement",
    priority: "medium",
    title: "Add Call-to-Action for Better Conversion",
    description: "Current messaging lacks clear CTA. Add action-oriented language to drive conversions.",
    currentMessaging: "Our platform helps you manage content strategy.",
    suggestedMessaging: "Start optimizing your content strategy today—join thousands of creators already using our platform.",
    rationale: "Engagement analysis shows messages with clear CTAs have 3x higher conversion rates. Current messaging is informative but not action-oriented.",
    expectedImpact: "Expected 15-20% increase in sign-ups and trial conversions.",
    relatedPlanId: "plan-1",
  },
  {
    id: "opt-4",
    type: "sentiment",
    priority: "low",
    title: "Reduce Technical Jargon",
    description: "Sentiment analysis indicates audience finds technical terms less engaging. Simplify language.",
    currentMessaging: "Leverage our AI-powered multi-agent orchestration framework.",
    suggestedMessaging: "Use our smart AI tools that work together to help you create better content faster.",
    rationale: "Sentiment scores drop 0.3 points when technical jargon is used. Simplified language increases accessibility and engagement.",
    expectedImpact: "Expected 10-15% improvement in message comprehension and engagement.",
    relatedPlanId: "plan-1",
    relatedSentimentId: "sentiment-1",
  },
];

function SuggestionCard({ suggestion }: { suggestion: OptimizationSuggestion }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isApplied, setIsApplied] = useState(false);

  const getTypeIcon = () => {
    switch (suggestion.type) {
      case "sentiment":
        return IconHeart;
      case "trend":
        return IconTrending;
      case "engagement":
        return IconSparkles;
      default:
        return IconSparkles;
    }
  };

  const getTypeColor = () => {
    switch (suggestion.type) {
      case "sentiment":
        return "text-red-600 bg-red-50 border-red-200";
      case "trend":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "engagement":
        return "text-purple-600 bg-purple-50 border-purple-200";
      default:
        return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  const getPriorityBadge = () => {
    const badges = {
      high: (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          <div className="w-3 h-3">{IconAlertTriangle}</div>
          High Priority
        </span>
      ),
      medium: (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
          Medium Priority
        </span>
      ),
      low: (
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          Low Priority
        </span>
      ),
    };
    return badges[suggestion.priority];
  };

  const TypeIcon = getTypeIcon();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border ${getTypeColor()} shrink-0`}>
            <div className="w-5 h-5">{TypeIcon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-slate-800">{suggestion.title}</h3>
              {getPriorityBadge()}
            </div>
            <p className="text-sm text-slate-600 mb-2">{suggestion.description}</p>
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
              {suggestion.relatedPlanId && (
                <>
                  <Link href="/plans" className="text-bagana-primary hover:text-bagana-secondary">
                    View Plan →
                  </Link>
                  <span>•</span>
                </>
              )}
              {suggestion.relatedSentimentId && (
                <>
                  <Link href="/sentiment" className="text-bagana-primary hover:text-bagana-secondary">
                    View Sentiment →
                  </Link>
                  <span>•</span>
                </>
              )}
              {suggestion.relatedTrendId && (
                <Link href="/trends" className="text-bagana-primary hover:text-bagana-secondary">
                  View Trend →
                </Link>
              )}
            </div>
          </div>
        </div>
        {isApplied && (
          <div className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 shrink-0">
            <div className="w-3 h-3">{IconCheck}</div>
            Applied
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-slate-100">
          {suggestion.currentMessaging && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Current Messaging</h4>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-700 italic">&quot;{suggestion.currentMessaging}&quot;</p>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Suggested Messaging</h4>
            <div className="rounded-lg border border-bagana-primary/30 bg-bagana-muted/20 p-3">
              <p className="text-sm text-slate-800">&quot;{suggestion.suggestedMessaging}&quot;</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Rationale</h4>
            <p className="text-sm text-slate-600 leading-relaxed">{suggestion.rationale}</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Expected Impact</h4>
            <p className="text-sm text-slate-600 leading-relaxed">{suggestion.expectedImpact}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-medium text-bagana-primary hover:text-bagana-secondary transition-colors"
        >
          {isExpanded ? "Show Less" : "Show Details"}
        </button>
        {!isApplied && (
          <>
            <span className="text-slate-300">•</span>
            <button
              onClick={() => setIsApplied(true)}
              disabled
              className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Apply Suggestion — Integration epic"
            >
              Apply Suggestion
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function OptimizationFilters() {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 className="font-semibold text-slate-800 mb-4">Filters</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="type-filter" className="block text-sm font-medium text-slate-700 mb-2">
            Type
          </label>
          <select
            id="type-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
          >
            <option value="all">All Types</option>
            <option value="sentiment">Sentiment-Based</option>
            <option value="trend">Trend-Based</option>
            <option value="engagement">Engagement-Based</option>
          </select>
        </div>
        <div>
          <label htmlFor="priority-filter" className="block text-sm font-medium text-slate-700 mb-2">
            Priority
          </label>
          <select
            id="priority-filter"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export function MessagingOptimizationView() {
  const suggestions = MOCK_SUGGESTIONS;

  const filteredSuggestions = suggestions.filter((s) => {
    // Filter logic would be applied here when filters are connected
    return true;
  });

  const stats = {
    total: suggestions.length,
    highPriority: suggestions.filter((s) => s.priority === "high").length,
    sentimentBased: suggestions.filter((s) => s.type === "sentiment").length,
    trendBased: suggestions.filter((s) => s.type === "trend").length,
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Suggestions</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>
            <div className="text-slate-400">
              <div className="w-6 h-6">{IconSparkles}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">High Priority</p>
              <p className="text-2xl font-bold text-red-600">{stats.highPriority}</p>
            </div>
            <div className="text-red-400">
              <div className="w-6 h-6">{IconAlertTriangle}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Sentiment-Based</p>
              <p className="text-2xl font-bold text-red-600">{stats.sentimentBased}</p>
            </div>
            <div className="text-red-400">
              <div className="w-6 h-6">{IconHeart}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Trend-Based</p>
              <p className="text-2xl font-bold text-blue-600">{stats.trendBased}</p>
            </div>
            <div className="text-blue-400">
              <div className="w-6 h-6">{IconTrending}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-slate-600">
          AI-powered suggestions to optimize messaging and engagement based on sentiment analysis and trend insights.
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Generate Suggestions — Integration epic"
          >
            <div className="w-4 h-4">{IconSparkles}</div>
            Generate Suggestions
          </button>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
          >
            Optimize via Chat
            <div className="w-4 h-4">{IconArrowRight}</div>
          </Link>
        </div>
      </div>

      <OptimizationFilters />

      {filteredSuggestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
            <div className="w-7 h-7">{IconSparkles}</div>
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">No optimization suggestions yet</h3>
          <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
            Generate suggestions from your content plans, sentiment analysis, and trend insights to optimize messaging and engagement.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
            >
              Generate via Chat
            </Link>
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Generate Suggestions — Integration epic"
            >
              Generate Suggestions
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Suggestions ({filteredSuggestions.length})
            </h2>
          </div>
          <ul className="space-y-4">
            {filteredSuggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <SuggestionCard suggestion={suggestion} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-amber-600 shrink-0 mt-0.5">ℹ️</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-800 mb-1">P1 Feature</h4>
            <p className="text-xs text-amber-700">
              Messaging Optimization (F5) is a P1 feature. UI is ready; backend integration (optimization agent, sentiment/trend data analysis) is deferred to P1 epic. Suggestions combine sentiment analysis and trend insights to optimize messaging and engagement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
