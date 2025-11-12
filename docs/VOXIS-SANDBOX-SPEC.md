# VOXIS: The Personal Voice Lab — Sandbox Technical Specification

## Product Philosophy
- **Name:** VOXIS — The Personal Voice Lab.
- **Guiding Principle:** "Your private playground. Create responsibly."
- **Purpose:** Provide a personal, responsibility-first environment for creating AI-generated voice assets. All generated outputs are private by default, and the product intentionally discourages abusive or deceptive public sharing.

## Core User Experience

### 1. Mandatory Commitment Gate (Onboarding & Legal Compliance)
- Triggered on first launch and whenever the session has no recorded consent.
- Fullscreen, non-dismissible modal titled **"Cảnh báo & Cam kết"**.
- Content includes welcome copy and three mandatory checkboxes:
  1. Acknowledgement that producing deceptive, fraudulent, or defamatory content is illegal.
  2. Commitment to personal, research, or licensed project usage only.
  3. Acceptance of full legal responsibility for audio generated through VOXIS.
- **Action button:** `Tôi Đồng ý và Tiếp tục`.
  - Disabled until all checkboxes are checked.
  - Persists consent locally (e.g., secure storage) for future sessions.

### 2. Voice Lab (Clone Management)
- Removes legacy "Verified" requirement; cloning is frictionless within sandbox limits.
- **Entry call-to-action:** prominent `+` button to add a new voice profile.
- Upon tapping `+`, prompt: **"Bạn muốn clone giọng từ đâu?"** with two options:
  - `Ghi âm trực tiếp` — record within the app, enforce a 60-second minimum.
  - `Tải lên tập tin âm thanh` — upload ≥60s audio file; perform noise quality validation.
- After providing audio, user must assign a custom label (e.g., "Giọng của tôi", "Giọng mẫu thử nghiệm A").
- Store each profile with metadata (name, source type, duration, createdAt, watermark seed, etc.).

### 3. Studio (Text-to-Speech Generation)
- Select any cloned voice from the Voice Lab inventory.
- Input script text, choose XTTS-supported language, adjust synthesis controls (speed, emotion sliders, etc.).
- Initiate rendering and route generation jobs to Coqui XTTS backend.

### 4. Library & Export (Personal Sandbox Controls)
- **No social sharing.** Remove/omit any share-to-social buttons.
- **Download only:** provide `Tải về` action to export `.mp3` / `.wav` files.
- When downloading, show confirmation modal mirroring onboarding tone:
  - Warning copy reminding responsible use.
  - Buttons: `Tôi cam kết và Tải về` (primary) and `Hủy` (secondary).
- All exported audio must embed an **inaudible watermark** containing at minimum the creator's UserID (and ideally session/timestamp) for forensic tracing.

## Technical Requirements
- **Audio Watermarking:**
  - Mandatory for every exported file.
  - Encodes identifiable metadata (UserID, generation job ID).
  - Must survive basic format conversions and volume adjustments while remaining imperceptible.
- **Backend Integration:**
  - Use Coqui.ai XTTS for cloning and speech synthesis.
  - Manage asynchronous jobs, enforce duration minimums, and log metadata for auditability.
- **Storage & Security:**
  - Retain user-generated voices and logs securely; ensure compliance with data retention policies.
  - Consent state and local configuration cached client-side.
- **Scalability:** Architecture designed for limited beta/batch access but extensible to broader rollout.

## UI/UX Direction
- Dark, futuristic "pro lab" aesthetic with sharp controls and technical iconography.
- Motion and micro-interactions should imply precision and professionalism rather than playful gadgetry.
- Maintain consistent Vietnamese localization for customer-facing copy.

## Business Model Guidance
- Current stage: private sandbox / beta.
- Recommended monetization path when scaling:
  - **Credit-based usage** model for ongoing consumption.
  - Optionally gate onboarding with a one-time **paid access fee** (e.g., $10) bundling starter credits to filter unserious users.

## Primary User Flow Summary
1. **Commitment Modal:** User accepts legal & responsible-use agreement.
2. **Voice Lab:** User records or uploads ≥60s audio, names the new voice clone.
3. **Studio:** User selects a voice, inputs text, configures XTTS settings, and renders audio.
4. **Library:** User reviews outputs, downloads files after reaffirming responsible use. No direct share pathways.
5. **Watermarking:** Every downloaded asset is watermarked with user-identifiable data for accountability.

## Deliverables for Engineering
- Implement onboarding modal with consent persistence.
- Build Voice Lab CRUD experience supporting recording/upload with validation and naming.
- Integrate XTTS-backed Studio interface honoring existing sliders and multilingual selection.
- Redesign Library to remove sharing, add responsible-use download gate, and embed watermark pipeline.
- Ensure UI adheres to dark, professional theme guidelines throughout.

