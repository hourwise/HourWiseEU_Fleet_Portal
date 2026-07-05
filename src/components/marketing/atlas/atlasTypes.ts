export type AtlasIntent = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  followUps?: string[];
  cta?: {
    label: string;
    action: 'earlyAccess' | 'featureRequest' | 'contact' | 'search';
  };
};

export type AtlasMode =
  | 'intro'
  | 'chat'
  | 'collectingFeedback'
  | 'submitted';

export type AtlasMessage = {
  id: string;
  role: 'atlas' | 'user' | 'system';
  text: string;
  createdAt: Date;
  intentId?: string;
  isFeedbackPrompt?: boolean;
};
