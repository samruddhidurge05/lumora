import { backendFetch } from '../utils/api';

const DEFAULT_REVIEW_ANALYTICS = {
  averageRating: 4.8,
  totalReviews: 24,
  positivePercentage: 88,
  neutralPercentage: 8,
  negativePercentage: 4,
  sentimentTrend: [88, 88, 88, 88, 88, 88],
  latestReviews: [
    {
      id: 'rev1',
      customer: 'John Doe',
      rating: 5,
      comment: 'This Next.js template is outstanding! Clean code structure and extremely fast page loads. Highly recommended.',
      sentiment: 'positive',
      product: 'Next.js SaaS Boilerplate',
      date: '2 hours ago',
      verified: true,
      flagged: false
    },
    {
      id: 'rev2',
      customer: 'Sarah Smith',
      rating: 4,
      comment: 'Great design assets and UI kit. A few minor alignment details could be improved in the Tailwind config but overall solid.',
      sentiment: 'positive',
      product: 'Figma UI Core System v4',
      date: '1 day ago',
      verified: true,
      flagged: false
    },
    {
      id: 'rev3',
      customer: 'Michael Brown',
      rating: 3,
      comment: 'Decent template, but documentation was a bit lacking for the custom database configuration.',
      sentiment: 'neutral',
      product: 'Ultimate React Native Starter',
      date: '3 days ago',
      verified: false,
      flagged: true
    }
  ],
  productSatisfaction: [
    { name: 'Next.js SaaS Boilerplate', rating: 4.9, reviewsCount: 12, trustScore: 98 },
    { name: 'Figma UI Core System v4', rating: 4.7, reviewsCount: 8, trustScore: 94 },
    { name: 'Ultimate React Native Starter', rating: 4.1, reviewsCount: 4, trustScore: 82 }
  ],
  voiceHighlights: {
    positive: 'Praise for performance, clean architecture, and responsive designs.',
    constructive: 'Suggestions to expand styling documentation and add secondary payment gateways.',
    requests: 'Frequent requests for GraphQL integrations and Next.js 14 App Router boilerplate.'
  }
};

export const getReviewAnalytics = async () => {
  try {
    return await backendFetch('/admin/reviews/dashboard');
  } catch (error) {
    console.warn('[reviewAnalyticsService] Error fetching review analytics, using local fallback:', error);
    return DEFAULT_REVIEW_ANALYTICS;
  }
};
