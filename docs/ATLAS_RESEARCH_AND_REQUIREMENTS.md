# Atlas — Research Additions and Requirements

## Purpose

Atlas is the assistant layer for the HourWise portal and driver app. It combines live fleet data, legal and operational rules, company procedures, route context, document retrieval, governed actions, and text/voice interaction.

Atlas must remain auditable even when it feels conversational.

## Voice-provider abstraction

```ts
interface SpeechRecognitionProvider {
  mode: "on-device" | "local-service" | "cloud";
  supportedLocales(): Promise<string[]>;
  startStream(config: unknown): unknown;
  transcribeFile(file: unknown): Promise<Transcript>;
}
```

Provider categories:
- native mobile speech
- hosted ASR
- local companion process
- multilingual streaming ASR
- future full-duplex speech-to-speech

## Streaming ASR requirements

- partial transcripts
- punctuation/capitalisation
- locale detection
- confidence values
- alternatives
- interruption support
- low latency
- degraded-network behaviour
- audio retention policy
- privacy controls

```ts
interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
  locale?: string;
  alternatives?: string[];
  requiresConfirmation: boolean;
}
```

## Full-duplex voice

Future full-duplex mode may support interruption, overlap, and more natural turn-taking. It must not become the authoritative record.

```text
Audio interaction
      ↓
Verified transcript and intent
      ↓
Atlas reasoning and retrieval
      ↓
Ananke-governed action
      ↓
Text result
      ↓
Spoken response
```

## Confirmation rules

Confirm ambiguous commands involving:
- external messages
- depot notification
- rota changes
- route changes
- incidents
- legal-time calculations
- compliance advice
- driver/vehicle reassignment
- expenses
- destructive actions

Example: “Did you say 12 minutes away or 20 minutes away?”

## Evidence and audit

Retain:
- user request
- transcript and confidence
- interpreted intent
- source data
- document references
- query/calculation inputs
- policy checks
- approval
- final text
- spoken response reference
- resulting action

## Separate source types

### Live authoritative data
Shifts, driving time, jobs, routes, vehicles, drivers, maintenance, licences, incidents, and messages.

### Retrieved documents
Site procedures, policies, depot notes, customer instructions, manuals.

### Generated reasoning
Summaries, suggestions, risk predictions, and recommendations.

These must never be presented as equivalent.

## Guided portal actions

Safe progression:
1. explain
2. highlight controls
3. prefill values
4. request approval
5. execute exact action
6. show evidence and result

Atlas should never silently operate the portal.

## Multilingual support

- locale-aware ASR and TTS
- preserve original transcript
- store translation separately
- warn on low-confidence translation
- company terminology glossary
- driver language preference
- reviewed legal wording

## Driver distraction controls

- short spoken replies
- no long menus while moving
- defer complex actions
- require stationary state when appropriate
- replay command
- interruptible speech
- avoid dense legal explanations while driving
- confirm important values

## Delivery order

### Phase 1
- text Atlas
- citations
- SQL-backed manager digest
- site-procedure retrieval
- governed outbound messaging

### Phase 2
- push-to-talk
- streaming transcript
- confidence and confirmation
- multilingual support
- TTS

### Phase 3
- interruption support
- route context
- guided portal actions
- driver/depot handoff

### Phase 4
- full-duplex mode
- local/offline voice
- predictive assistance
- advanced behavioural automation
