// ============================================================
// Mandala Platform — Shared Types
// ============================================================

// === Tenant ===

export type TenantType = 'internal' | 'client';
export type ChannelType = 'whatsapp' | 'whatsapp_business' | 'telegram' | 'instagram';
export type Mode = 'ceo-assistant' | 'sales-shadow';

export interface TenantConfig {
  id: string;
  name: string;
  type: TenantType;
  active: boolean;
  owner?: {
    name: string;
    whatsapp: string;
    timezone: string;
    github?: string;
  };
  channels: ChannelConfig[];
  ai: AIConfig;
  routing: RoutingConfig;
  handoff: HandoffConfig;
  scoring?: ScoringConfig;
  knowledge: string[];
  cron?: Record<string, string>;
}

export interface ChannelConfig {
  type: ChannelType;
  number?: string;
  provider?: string;
  bot_token?: string;
  bot_username?: string;
  role: 'primary' | 'secondary';
}

export interface AIConfig {
  conversation_model: string;
  classifier_model: string;
  temperature: number;
  max_tokens: number;
  fallback_model?: string;
}

export interface RoutingConfig {
  owner_numbers: string[];
  admin_numbers: string[];
  default_mode: Mode;
}

export interface HandoffConfig {
  auto_takeover_delay_seconds: number;
  typing_indicator_cancel: boolean;
  flag_response_timeout_seconds: number;
  response_delay: {
    min_seconds: number;
    max_seconds: number;
    long_delay_chance: number;
  };
}

export interface ScoringConfig {
  hot_threshold: number;
  warm_threshold: number;
  cold_threshold: number;
}

// === Messages ===

export type MessageDirection = 'incoming' | 'outgoing';
export type MessageSender = 'customer' | 'owner' | 'admin' | 'mandala';

export interface Message {
  id: string;
  conversation_id: string;
  tenant_id: string;
  direction: MessageDirection;
  sender: MessageSender;
  sender_number: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// === Conversations ===

export type ConversationStatus = 'active' | 'waiting' | 'closed';
export type Handler = 'owner' | 'admin' | 'mandala' | 'unassigned';
export type ConversationPhase = 'kenalan' | 'gali_masalah' | 'tawarkan_solusi' | 'closing' | 'rescue';

export interface Conversation {
  id: string;
  tenant_id: string;
  customer_number: string;
  customer_name?: string;
  status: ConversationStatus;
  current_handler: Handler;
  mode: Mode;
  phase: ConversationPhase;
  lead_score: number;
  messages: Message[];
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
  last_owner_reply_at?: Date;
  metadata?: Record<string, unknown>;
}

// === Lead Scoring ===

export type LeadTemperature = 'hot' | 'warm' | 'lukewarm' | 'cold' | 'not_fit';

export interface LeadScore {
  conversation_id: string;
  score: number;
  temperature: LeadTemperature;
  signals: ScoreSignal[];
  updated_at: Date;
}

export interface ScoreSignal {
  type: 'positive' | 'negative';
  signal: string;
  points: number;
  detected_at: Date;
}

// === Handoff ===

export type HandoffDirection = 'owner_to_mandala' | 'mandala_to_owner' | 'mandala_flag_owner';

export interface HandoffEvent {
  id: string;
  conversation_id: string;
  direction: HandoffDirection;
  reason: string;
  timestamp: Date;
}

// === Context Assembly ===

export interface AssembledContext {
  identity: string;
  rules: string;
  mode: string;
  phase_instruction?: string;
  task_context?: string;
  skills: string[];
  knowledge: string[];
  customer_memory?: string;
  memory_recall?: string;
  conversation_history: Message[];
  lead_score?: LeadScore;
  style_reference?: string;
}

// === AI Response ===

export interface AIResponse {
  messages: string[]; // Array because we split into multiple chat messages
  delays: number[];   // Delay before each message (ms)
  internal: {
    intent: string;
    confidence: number;
    score_update?: Partial<ScoreSignal>;
    should_flag_owner: boolean;
    flag_reason?: string;
  };
}

// === Webhook Events ===

export interface WhatsAppWebhook {
  sender: string;
  message: string;
  timestamp: number;
  message_id?: string;
  media_url?: string;
}

export interface TelegramWebhook {
  chat_id: number;
  from_id: number;
  message: string;
  timestamp: number;
}
