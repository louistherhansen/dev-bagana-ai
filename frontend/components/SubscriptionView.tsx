"use client";

import { useState } from "react";
import { IconCheck, IconSparkles } from "@/components/icons";

type SubscriptionPlan = {
  id: "free" | "monthly" | "annual";
  name: string;
  price: string;
  pricePerMonth?: string;
  description: string;
  features: string[];
  popular?: boolean;
};

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free Plan",
    price: "$0",
    pricePerMonth: "Free forever",
    description: "Perfect for trying out BAGANA AI",
    features: [
      "Up to 3 content plans",
      "Basic sentiment analysis",
      "Basic trend insights",
      "Up to 3 talents",
      "Community support",
      "No credit card required",
    ],
  },
  {
    id: "monthly",
    name: "Monthly Subscription",
    price: "$49",
    pricePerMonth: "$49/month",
    description: "Perfect for small teams and individual creators",
    features: [
      "Unlimited content plans",
      "Sentiment analysis",
      "Trend insights",
      "Up to 10 talents",
      "Email support",
      "Cancel anytime",
    ],
  },
  {
    id: "annual",
    name: "Annual Subscription",
    price: "$490",
    pricePerMonth: "$41/month",
    description: "Best value for growing agencies",
    features: [
      "Everything in Monthly",
      "Priority support",
      "Up to 50 talents",
      "Advanced analytics",
      "API access",
      "Save 16% annually",
    ],
    popular: true,
  },
];

function SubscriptionCard({
  plan,
  onSelect,
}: {
  plan: SubscriptionPlan;
  onSelect: (planId: string) => void;
}) {
  return (
    <div
      className={`relative flex flex-col h-full rounded-xl border-2 p-6 sm:p-8 bg-white shadow-sm hover:shadow-md transition-all ${
        plan.popular
          ? "border-bagana-primary bg-gradient-to-br from-bagana-primary/5 to-white"
          : "border-slate-200"
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-bagana-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}
      <div className="text-center mb-6 flex-shrink-0">
        <h3 className="text-xl font-bold text-slate-800 mb-2 min-h-[28px]">{plan.name}</h3>
        <div className="mb-2 min-h-[48px] flex items-center justify-center flex-col">
          <div>
            <span className="text-3xl font-bold text-slate-800">{plan.price}</span>
            {plan.pricePerMonth && plan.id !== "free" && (
              <span className="text-sm text-slate-500 ml-2">/ {plan.pricePerMonth.split("/")[1]}</span>
            )}
          </div>
          {plan.id === "free" && (
            <p className="text-sm text-slate-500 mt-1">{plan.pricePerMonth}</p>
          )}
          {plan.pricePerMonth && plan.id === "annual" && (
            <p className="text-xs text-slate-500 mt-1">Billed annually</p>
          )}
        </div>
        <p className="text-sm text-slate-600 mt-3 min-h-[40px]">{plan.description}</p>
      </div>
      <ul className="space-y-3 mb-6 flex-grow">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
            <span className="text-bagana-primary shrink-0 mt-0.5">{IconCheck}</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => onSelect(plan.id)}
        className={`w-full rounded-xl px-5 py-3 text-sm font-medium transition-colors mt-auto flex-shrink-0 ${
          plan.id === "free"
            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
            : plan.popular
            ? "bg-bagana-primary text-white hover:bg-bagana-secondary"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
      >
        {plan.id === "free" ? "Get Started Free" : "Subscribe Now"}
      </button>
    </div>
  );
}

function CompanyAgencyForm({ onSubmit }: { onSubmit: (email: string, company: string) => void }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && company.trim()) {
      onSubmit(email, company);
      setSubmitted(true);
      setTimeout(() => {
        setEmail("");
        setCompany("");
        setSubmitted(false);
      }, 3000);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 sm:p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-3">
          {IconCheck}
        </div>
        <h3 className="font-semibold text-emerald-800 mb-1">Request Sent!</h3>
        <p className="text-sm text-emerald-700">
          We'll contact you soon to discuss your agency's needs.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-bagana-muted/50 text-bagana-primary mb-3">
          {IconSparkles}
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Company Agency</h3>
        <p className="text-sm text-slate-600">
          Custom pricing and features for agencies managing multiple teams and campaigns
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="company-name" className="block text-sm font-medium text-slate-700 mb-2">
            Company Name
          </label>
          <input
            id="company-name"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Your agency name"
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-bagana-primary focus:outline-none focus:ring-2 focus:ring-bagana-primary/20"
          />
        </div>
        <div>
          <label htmlFor="company-email" className="block text-sm font-medium text-slate-700 mb-2">
            Business Email
          </label>
          <input
            id="company-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@yourcompany.com"
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-bagana-primary focus:outline-none focus:ring-2 focus:ring-bagana-primary/20"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-bagana-primary px-5 py-3 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
        >
          Request Custom Quote
        </button>
        <p className="text-xs text-slate-500 text-center">
          We'll send you a custom pricing proposal within 24 hours
        </p>
      </form>
    </div>
  );
}

export function SubscriptionView() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    if (planId === "free") {
      // In production, this would create free account or redirect to signup
      alert("Get Started with Free Plan!\n\nIn production, this would redirect to signup/onboarding flow.");
    } else {
      // In production, this would redirect to payment gateway (Stripe, etc.)
      alert(`Redirecting to payment for ${planId === "monthly" ? "Monthly" : "Annual"} subscription...\n\nIn production, this would integrate with payment gateway (Stripe, PayPal, etc.).`);
    }
  };

  const handleCompanySubmit = (email: string, company: string) => {
    // In production, this would send email to sales team
    console.log("Company Agency inquiry:", { email, company });
    // Could integrate with email service (SendGrid, Resend, etc.)
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">
          Choose Your Plan
        </h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Select the subscription that fits your team. All plans include access to content planning, sentiment analysis, and trend insights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <SubscriptionCard key={plan.id} plan={plan} onSelect={handleSelectPlan} />
        ))}
      </div>

      <div className="max-w-md mx-auto">
        <CompanyAgencyForm onSubmit={handleCompanySubmit} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-xs text-slate-600">
          💳 Payment integration (Stripe/PayPal) — Integration epic. All subscription plans are frontend UI only.
        </p>
      </div>
    </div>
  );
}
