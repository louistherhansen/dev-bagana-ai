import Link from "next/link";

type FeatureStubProps = {
  title: string;
  description: string;
  href?: string;
  icon: React.ReactNode;
};

export function FeatureStub({
  title,
  description,
  href,
  icon,
}: FeatureStubProps) {
  const content = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-bagana-primary/20">
      <div className="mb-3 sm:mb-4 inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-bagana-muted/50 text-bagana-primary">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-800 mb-1 text-base sm:text-lg">{title}</h3>
      <p className="text-sm text-slate-600 mb-4 line-clamp-3">{description}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return (
    <div className="opacity-75 cursor-not-allowed" title="Coming soon">
      {content}
    </div>
  );
}
