'use client'

import { useState } from 'react';
import { ArrowRight, ExternalLink, Package } from 'lucide-react';
import { codecanyonScripts, CodeCanyonScriptSummary, getAllCategories } from '@/lib/codecanyon-scripts';
import Link from 'next/link';

export default function CodeCanyonScripts() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const categories = ['All', ...getAllCategories()];
  const filteredScripts = selectedCategory === 'All' 
    ? codecanyonScripts 
    : codecanyonScripts.filter(s => s.category === selectedCategory);

  return (
    <section id="codecanyon-scripts" className="py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Package size={16} />
            CodeCanyon Script Installation Service
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            Professional <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Installation Plans</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose from our flexible installation plans designed to meet your specific needs. We support all CodeCanyon scripts.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Scripts List Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredScripts.map((script) => (
            <ScriptListItem key={script.id} script={script} />
          ))}
        </div>

        {/* Generic Plans Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4 text-gray-900">
              Don&apos;t See Your Script?
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We install and configure any CodeCanyon script. Contact us with your script details and we&apos;ll provide a custom quote.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScriptListItem({ script }: { script: CodeCanyonScriptSummary }) {
  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-3">
              {script.category}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{script.name}</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">{script.shortDescription}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200">
          
          <Link
            href={`/services/codecanyon/${script.id}`}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all hover:scale-105 font-semibold text-sm"
          >
            View Plans
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}


