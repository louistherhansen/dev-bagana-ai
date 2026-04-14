"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  IconEye,
  IconClipboard,
  IconHeart,
  IconTrending,
  IconChart,
  IconCheck,
  IconX,
  IconClock,
  IconAlertTriangle,
} from "@/components/icons";
import { getAllPlans, type ContentPlanSummary } from "@/lib/contentPlans";

/**
 * Review Status Types
 */
type ReviewStatus = "pending" | "approved" | "rejected" | "needs_revision";

/**
 * Review Item Interface
 */
interface ReviewItem {
  id: string;
  type: "plan" | "sentiment" | "trend" | "report";
  title: string;
  campaign?: string;
  brandName?: string;
  status: ReviewStatus;
  createdAt: number;
  updatedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  notes?: string;
  priority: "low" | "medium" | "high";
  brandSafetyRisk?: "low" | "medium" | "high";
}

/**
 * Review Dashboard View
 * Phase 3: Review and approval interface for all artifacts
 */
export function ReviewDashboardView() {
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);

  // Load review items from database
  const loadReviewItems = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load plans from database
      const plans = await getAllPlans();
      
      // Convert plans to review items
      const planItems: ReviewItem[] = plans.map((plan) => ({
        id: plan.id,
        type: "plan" as const,
        title: plan.title,
        campaign: plan.campaign,
        brandName: plan.brandName,
        status: "pending" as ReviewStatus, // Default status
        createdAt: plan.updatedAt, // Use updatedAt as proxy
        updatedAt: plan.updatedAt,
        priority: "medium" as const,
        brandSafetyRisk: plan.schemaValid ? "low" as const : "medium" as const,
      }));
      
      // TODO: Load sentiment and trend items from database when available
      // For now, use empty arrays
      const sentimentItems: ReviewItem[] = [];
      const trendItems: ReviewItem[] = [];
      const reportItems: ReviewItem[] = [];
      
      const allItems = [...planItems, ...sentimentItems, ...trendItems, ...reportItems];
      
      // Sort by updatedAt descending (most recent first)
      allItems.sort((a, b) => b.updatedAt - a.updatedAt);
      
      setReviewItems(allItems);
    } catch (error) {
      console.error("Error loading review items:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviewItems();
  }, [loadReviewItems]);

  // Filter items by status
  const filteredItems = reviewItems.filter((item) => {
    if (activeTab === "all") return true;
    return item.status === activeTab;
  });

  // Group items by type
  const itemsByType = {
    plan: filteredItems.filter((item) => item.type === "plan"),
    sentiment: filteredItems.filter((item) => item.type === "sentiment"),
    trend: filteredItems.filter((item) => item.type === "trend"),
    report: filteredItems.filter((item) => item.type === "report"),
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadge = (status: ReviewStatus) => {
    const badges = {
      pending: (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          <span className="w-3 h-3">{IconClock}</span>
          Pending
        </span>
      ),
      approved: (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
          <span className="w-3 h-3">{IconCheck}</span>
          Approved
        </span>
      ),
      rejected: (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
          <span className="w-3 h-3">{IconX}</span>
          Rejected
        </span>
      ),
      needs_revision: (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
          <span className="w-3 h-3">{IconAlertTriangle}</span>
          Needs Revision
        </span>
      ),
    };
    return badges[status];
  };

  const getTypeIcon = (type: ReviewItem["type"]) => {
    const icons = {
      plan: IconClipboard,
      sentiment: IconHeart,
      trend: IconTrending,
      report: IconChart,
    };
    return icons[type];
  };

  const getTypeLabel = (type: ReviewItem["type"]) => {
    const labels = {
      plan: "Content Plan",
      sentiment: "Sentiment Analysis",
      trend: "Trend Insights",
      report: "Report",
    };
    return labels[type];
  };

  const getPriorityBadge = (priority: ReviewItem["priority"]) => {
    const badges = {
      low: (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          Low
        </span>
      ),
      medium: (
        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          Medium
        </span>
      ),
      high: (
        <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          High
        </span>
      ),
    };
    return badges[priority];
  };

  const getBrandSafetyBadge = (risk?: ReviewItem["brandSafetyRisk"]) => {
    if (!risk) return null;
    const badges = {
      low: (
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Low Risk
        </span>
      ),
      medium: (
        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          Medium Risk
        </span>
      ),
      high: (
        <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          High Risk
        </span>
      ),
    };
    return badges[risk];
  };

  const handleApprove = async (item: ReviewItem) => {
    // TODO: Implement approval API call
    console.log("Approve:", item.id);
    // Update local state
    setReviewItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: "approved" as ReviewStatus,
              reviewedAt: Date.now(),
              reviewedBy: "Current User", // TODO: Get from auth
            }
          : i
      )
    );
  };

  const handleReject = async (item: ReviewItem) => {
    // TODO: Implement rejection API call
    console.log("Reject:", item.id);
    // Update local state
    setReviewItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: "rejected" as ReviewStatus,
              reviewedAt: Date.now(),
              reviewedBy: "Current User", // TODO: Get from auth
            }
          : i
      )
    );
  };

  const handleRequestRevision = async (item: ReviewItem) => {
    // TODO: Implement revision request API call
    console.log("Request revision:", item.id);
    // Update local state
    setReviewItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: "needs_revision" as ReviewStatus,
              reviewedAt: Date.now(),
              reviewedBy: "Current User", // TODO: Get from auth
            }
          : i
      )
    );
  };

  function ReviewItemCard({ item }: { item: ReviewItem }) {
    const TypeIcon = getTypeIcon(item.type);
    const typeLabel = getTypeLabel(item.type);

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3 mb-2">
              <div className="text-bagana-primary shrink-0">{TypeIcon}</div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-800 truncate mb-1">{item.title}</h3>
                <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                    {typeLabel}
                  </span>
                  {item.campaign && (
                    <span className="rounded-md bg-blue-100 px-2 py-0.5 text-blue-700">
                      {item.campaign}
                    </span>
                  )}
                  {item.brandName && (
                    <span className="rounded-md bg-purple-100 px-2 py-0.5 text-purple-700">
                      {item.brandName}
                    </span>
                  )}
                  {getPriorityBadge(item.priority)}
                  {getBrandSafetyBadge(item.brandSafetyRisk)}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Created {formatDate(item.createdAt)}</span>
                  {item.reviewedAt && (
                    <>
                      <span>•</span>
                      <span>Reviewed {formatDate(item.reviewedAt)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
            {getStatusBadge(item.status)}
            {item.status === "pending" && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(item)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  <span className="w-3 h-3">{IconCheck}</span>
                  Approve
                </button>
                <button
                  onClick={() => handleRequestRevision(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Request Revision
                </button>
                <button
                  onClick={() => handleReject(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  <span className="w-3 h-3">{IconX}</span>
                  Reject
                </button>
              </div>
            )}
            {item.status === "needs_revision" && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(item)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  <span className="w-3 h-3">{IconCheck}</span>
                  Approve
                </button>
                <button
                  onClick={() => handleReject(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  <span className="w-3 h-3">{IconX}</span>
                  Reject
                </button>
              </div>
            )}
            {item.status === "approved" && (
              <Link
                href={`/${item.type === "plan" ? "plans" : item.type === "sentiment" ? "sentiment" : item.type === "trend" ? "trends" : "reports"}`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View Details →
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "all", label: "All", count: reviewItems.length },
    { id: "pending", label: "Pending", count: reviewItems.filter((i) => i.status === "pending").length },
    {
      id: "approved",
      label: "Approved",
      count: reviewItems.filter((i) => i.status === "approved").length,
    },
    {
      id: "rejected",
      label: "Rejected",
      count: reviewItems.filter((i) => i.status === "rejected").length,
    },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white/80">
        <nav className="flex gap-1 px-1" aria-label="Review sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-colors relative ${
                activeTab === tab.id
                  ? "bg-white text-bagana-primary border border-b-0 border-slate-200 -mb-px"
                  : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    activeTab === tab.id
                      ? "bg-bagana-primary/10 text-bagana-primary"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-slate-50/50 p-4 sm:p-6">
        {loading ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
              <div className="w-7 h-7">{IconEye}</div>
            </div>
            <p className="text-sm text-slate-600">Loading review items...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
              <div className="w-7 h-7">{IconEye}</div>
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">
              {activeTab === "all"
                ? "No items to review"
                : activeTab === "pending"
                ? "No pending reviews"
                : activeTab === "approved"
                ? "No approved items"
                : "No rejected items"}
            </h3>
            <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
              {activeTab === "all"
                ? "Create content plans, run sentiment analysis, or research trends to see items here."
                : "All items have been processed."}
            </p>
            {activeTab === "all" && (
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
              >
                Create via Chat
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Total Items</p>
                    <p className="text-2xl font-bold text-slate-800">{reviewItems.length}</p>
                  </div>
                  <div className="text-slate-400">{IconEye}</div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {reviewItems.filter((i) => i.status === "pending").length}
                    </p>
                  </div>
                  <div className="text-amber-400">{IconClock}</div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Approved</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {reviewItems.filter((i) => i.status === "approved").length}
                    </p>
                  </div>
                  <div className="text-emerald-400">{IconCheck}</div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">High Risk</p>
                    <p className="text-2xl font-bold text-red-600">
                      {reviewItems.filter((i) => i.brandSafetyRisk === "high").length}
                    </p>
                  </div>
                  <div className="text-red-400">{IconAlertTriangle}</div>
                </div>
              </div>
            </div>

            {/* Items by Type */}
            {itemsByType.plan.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <div className="w-5 h-5 text-bagana-primary">{IconClipboard}</div>
                  Content Plans ({itemsByType.plan.length})
                </h2>
                <ul className="space-y-3">
                  {itemsByType.plan.map((item) => (
                    <li key={item.id}>
                      <ReviewItemCard item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {itemsByType.sentiment.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <div className="w-5 h-5 text-red-600">{IconHeart}</div>
                  Sentiment Analysis ({itemsByType.sentiment.length})
                </h2>
                <ul className="space-y-3">
                  {itemsByType.sentiment.map((item) => (
                    <li key={item.id}>
                      <ReviewItemCard item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {itemsByType.trend.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <div className="w-5 h-5 text-blue-600">{IconTrending}</div>
                  Trend Insights ({itemsByType.trend.length})
                </h2>
                <ul className="space-y-3">
                  {itemsByType.trend.map((item) => (
                    <li key={item.id}>
                      <ReviewItemCard item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {itemsByType.report.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <div className="w-5 h-5 text-purple-600">{IconChart}</div>
                  Reports ({itemsByType.report.length})
                </h2>
                <ul className="space-y-3">
                  {itemsByType.report.map((item) => (
                    <li key={item.id}>
                      <ReviewItemCard item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Empty state for filtered view */}
            {filteredItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
                <p className="text-sm text-slate-600">No items match the selected filter.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
