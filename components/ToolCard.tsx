import Link from 'next/link';

interface ToolCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

export default function ToolCard({ title, description, href, icon }: ToolCardProps) {
  return (
    <Link
      href={href}
      className="group block p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-lg transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {title}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </Link>
  );
}

