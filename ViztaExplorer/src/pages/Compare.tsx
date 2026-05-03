import { GitCompare } from 'lucide-react';

export function Compare() {
  return (
    <div className="h-[calc(100vh-64px)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-4">
          <GitCompare size={40} className="text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Comparison View</h2>
        <p className="text-slate-400 max-w-md">
          Compare multiple query results side by side. This feature is coming soon.
        </p>
        <p className="text-sm text-slate-500 mt-4">
          Use the Experiments page to run tests and save results for comparison.
        </p>
      </div>
    </div>
  );
}
