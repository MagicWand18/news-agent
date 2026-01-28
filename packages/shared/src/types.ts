export interface NormalizedArticle {
  url: string;
  title: string;
  source: string;
  content?: string;
  publishedAt?: Date;
}

export interface AIAnalysisResult {
  summary: string;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";
  relevance: number;
  suggestedAction: string;
}

export interface OnboardingResult {
  suggestedKeywords: { word: string; type: string }[];
  competitors: string[];
  sensitiveTopics: string[];
  actionLines: string[];
  recentMentions: { title: string; url: string; source: string }[];
}

export interface AlertMessage {
  mentionId: string;
  clientName: string;
  articleTitle: string;
  articleUrl: string;
  source: string;
  timeAgo: string;
  sentiment: string;
  relevance: number;
  aiSummary: string;
  aiAction: string;
  urgency: string;
}

export interface DigestData {
  clientName: string;
  totalMentions: number;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  topMentions: {
    title: string;
    source: string;
    relevance: number;
    sentiment: string;
    summary: string;
  }[];
  aiExecutiveSummary: string;
}

export interface PreFilterResult {
  relevant: boolean;
  reason: string;
  confidence: number;
}

export interface ResponseGenerationResult {
  title: string;
  body: string;
  tone: "PROFESSIONAL" | "DEFENSIVE" | "CLARIFICATION" | "CELEBRATORY";
  audience: string;
  callToAction: string;
  keyMessages: string[];
}
