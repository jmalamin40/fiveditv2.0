'use client'

import { Star, RotateCcw, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import fiverrReviewsData from '@/data/fiverr-reviews.json';

interface FiverrReview {
  id: number;
  reviewerName: string;
  reviewerInitial: string;
  location: string;
  countryCode: string;
  isRepeatClient: boolean;
  rating: number;
  timePosted: string;
  reviewText: string;
  priceRange: string;
  duration: string;
  helpfulCount?: number;
}

const reviews: FiverrReview[] = fiverrReviewsData.reviews as FiverrReview[];

// Country flag emoji mapping
const getCountryFlag = (countryCode: string): string => {
  const flags: Record<string, string> = {
    US: '🇺🇸', DE: '🇩🇪', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸',
    NL: '🇳🇱', BE: '🇧🇪', CH: '🇨🇭', AT: '🇦🇹', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮',
    PL: '🇵🇱', IE: '🇮🇪', PT: '🇵🇹', GR: '🇬🇷', IN: '🇮🇳', BR: '🇧🇷', MX: '🇲🇽', JP: '🇯🇵',
    KR: '🇰🇷', CN: '🇨🇳', SG: '🇸🇬', MY: '🇲🇾', TH: '🇹🇭', ID: '🇮🇩', PH: '🇵🇭', VN: '🇻🇳',
    ZA: '🇿🇦', NG: '🇳🇬', EG: '🇪🇬', AE: '🇦🇪', SA: '🇸🇦', IL: '🇮🇱', TR: '🇹🇷', RU: '🇷🇺',
    MA: '🇲🇦', SC: '🇸🇨', KE: '🇰🇪', SE: '🇸🇪', MU: '🇲🇺', PK: '🇵🇰', RS: '🇷🇸', QA: '🇶🇦', AO: '🇦🇴',
  };
  return flags[countryCode] || '🌍';
};

const REVIEWS_PER_PAGE = 10;

export default function CustomerReviews() {
  const [helpfulCounts, setHelpfulCounts] = useState<Record<number, number>>(
    reviews.reduce((acc, review) => {
      acc[review.id] = review.helpfulCount || 0;
      return acc;
    }, {} as Record<number, number>)
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterRepeatClient, setFilterRepeatClient] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'rating'>('newest');

  // Filter and sort reviews
  const filteredAndSortedReviews = useMemo(() => {
    let filtered = [...reviews];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (review) =>
          review.reviewText.toLowerCase().includes(query) ||
          review.reviewerName.toLowerCase().includes(query) ||
          review.location.toLowerCase().includes(query)
      );
    }

    // Rating filter
    if (filterRating !== null) {
      filtered = filtered.filter((review) => review.rating === filterRating);
    }

    // Repeat client filter
    if (filterRepeatClient !== null) {
      filtered = filtered.filter((review) => review.isRepeatClient === filterRepeatClient);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          // Parse time posted - simple heuristic (you might want to add actual dates)
          return 0; // Keep original order for now
        case 'oldest':
          return 0; // Keep original order for now
        case 'rating':
          return b.rating - a.rating;
        default:
          return 0;
      }
    });

    return filtered;
  }, [searchQuery, filterRating, filterRepeatClient, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedReviews.length / REVIEWS_PER_PAGE);
  const startIndex = (currentPage - 1) * REVIEWS_PER_PAGE;
  const paginatedReviews = filteredAndSortedReviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterRating, filterRepeatClient, sortBy]);

  const handleHelpful = (reviewId: number) => {
    setHelpfulCounts((prev) => ({
      ...prev,
      [reviewId]: (prev[reviewId] || 0) + 1,
    }));
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        className={i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
      />
    ));
  };

  const stats = useMemo(() => {
    const totalReviews = reviews.length;
    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
    const repeatClients = reviews.filter((r) => r.isRepeatClient).length;
    const fiveStarReviews = reviews.filter((r) => r.rating === 5).length;

    return {
      totalReviews,
      averageRating: averageRating.toFixed(1),
      repeatClients,
      fiveStarReviews,
      satisfactionRate: ((fiveStarReviews / totalReviews) * 100).toFixed(0),
    };
  }, []);

  return (
    <section id="reviews" className="py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Star className="fill-yellow-400 text-yellow-400" size={16} />
            Fiverr Reviews
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            What Our <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Clients Say</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Real reviews from our {stats.totalReviews}+ Fiverr clients. See what they have to say about working with FivedIT.
          </p>
        </div>

        {/* Stats Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                {stats.totalReviews}+
              </div>
              <div className="text-gray-600 text-sm md:text-base">Fiverr Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                {stats.averageRating}/5
              </div>
              <div className="text-gray-600 text-sm md:text-base">Average Rating</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                {stats.repeatClients}
              </div>
              <div className="text-gray-600 text-sm md:text-base">Repeat Clients</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                {stats.satisfactionRate}%
              </div>
              <div className="text-gray-600 text-sm md:text-base">5-Star Reviews</div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Rating Filter */}
            <select
              value={filterRating === null ? 'all' : filterRating.toString()}
              onChange={(e) => setFilterRating(e.target.value === 'all' ? null : parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
            </select>

            {/* Repeat Client Filter */}
            <select
              value={filterRepeatClient === null ? 'all' : filterRepeatClient.toString()}
              onChange={(e) => setFilterRepeatClient(e.target.value === 'all' ? null : e.target.value === 'true')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Clients</option>
              <option value="true">Repeat Clients</option>
              <option value="false">New Clients</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'rating')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-gray-600">
            Showing {paginatedReviews.length} of {filteredAndSortedReviews.length} reviews
          </div>
        </div>

        {/* Fiverr-Style Review Cards */}
        <div className="space-y-6 mb-8">
          {paginatedReviews.length > 0 ? (
            paginatedReviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4 mb-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center text-amber-800 font-bold text-lg flex-shrink-0">
                    {review.reviewerInitial}
                  </div>

                  {/* Reviewer Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900">{review.reviewerName}</span>
                      <span className="text-gray-500 text-sm flex items-center gap-1">
                        <span>{getCountryFlag(review.countryCode)}</span>
                        {review.location}
                      </span>
                      {review.isRepeatClient && (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          <RotateCcw size={12} />
                          Repeat Client
                        </span>
                      )}
                    </div>

                    {/* Rating and Time */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-1">
                        {renderStars(review.rating)}
                      </div>
                      <span className="text-gray-500 text-sm">{review.timePosted}</span>
                    </div>

                    {/* Review Text */}
                    <p className="text-gray-700 leading-relaxed mb-4">{review.reviewText}</p>

                    {/* Price and Duration */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-4 pb-4 border-b border-gray-200">
                      <span>{review.priceRange}</span>
                      <span className="text-gray-300">|</span>
                      <span>{review.duration}</span>
                    </div>

                    {/* Helpful Section */}
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">Helpful?</span>
                      <button
                        onClick={() => handleHelpful(review.id)}
                        className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors"
                        aria-label="Mark as helpful"
                      >
                        <ThumbsUp size={16} />
                        <span className="text-sm">Yes</span>
                      </button>
                      <button
                        className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors"
                        aria-label="Mark as not helpful"
                      >
                        <ThumbsDown size={16} />
                        <span className="text-sm">No</span>
                      </button>
                      {helpfulCounts[review.id] > 0 && (
                        <span className="text-sm text-gray-500">
                          ({helpfulCounts[review.id]} found this helpful)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-500 text-lg">No reviews found matching your filters.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <ChevronLeft size={18} />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
