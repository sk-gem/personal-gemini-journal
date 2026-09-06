# Personal Gemini Journal

A secure, user-authenticated journaling web application with Google Sign-In, server-side Gemini AI reflections, and user-isolated Cloud Firestore storage.

---

## 1. Threat Model & Security Posture

| Threat Zone | Identified Risk | Countermeasures & Applied Controls |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Prompt injection, malicious payloads, buffer exhaustion, audio stream spoofing. | Strict input schema validation, content length boundary enforcement, 16kHz PCM audio validation, and payload sanitization stripping `undefined` fields. |
| **2. Planning & Reasoning** | System instruction bypass through unvetted journal entries or voice audio. | System instruction sandboxing, treating all user inputs as untrusted contextual data, clear delimiter boundaries. |
| **3. Tool Execution** | Exposure of `GEMINI_API_KEY` to client browser; API outages. | Zero client-side API keys; server-side Express proxy and WebSocket bridge for Gemini Live; ephemeral connection handling; automated model fallback ladder. |
| **4. Memory & State** | Cross-user data leakage in database; unauthorized read/writes. | Strict owner-bound Cloud Firestore security rules (`request.auth.uid == userId`); verified Firebase Auth tokens; zero insecure defaults (`allow read, write: if true;` prohibited). |
| **5. Inter-System Communication** | Token interception between Cloud Run, Firebase, and Gemini; insecure WebSockets. | Transport Layer Security (HTTPS/WSS), Secret Manager environment bindings, connection-isolated WebSocket sessions, and IAM least-privilege service account permissions. |

---

## 2. Cloud Firestore Security Rules

To enforce strict user data isolation, the application enforces the following rules in `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /journals/{journalId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Deploy the rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 3. Secret Management Setup (Google Cloud Secret Manager)

To prevent hardcoded credentials, store your Gemini API key in Google Cloud Secret Manager and grant access to the Cloud Run runtime service account:

```bash
# 1. Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 2. Create and populate the GEMINI_API_KEY secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant the default Cloud Run service account access to read the secret
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Google Cloud Run Deployment & Campaign Registration

### Deploy to Cloud Run

Deploy the container to Cloud Run with the Secret Manager secret injected as an environment variable:

```bash
# Build and deploy service
gcloud run deploy personal-gemini-journal \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### Apply Campaign Verification Label

Apply the mandatory challenge verification label to your Cloud Run service:

```bash
gcloud run services update personal-gemini-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 5. Functional Stability Walkthrough & Testing Scenarios

Every interaction and process available to the user has a corresponding verification test case:

### Test Case 1: Landing Page & Google Sign-In Flow
1. **Navigate to the App URL** when not authenticated.
2. **Verify Elements**: Confirm that the landing page displays the title *"Personal Gemini Journal"*, security badges (*"Owner Data Isolation Active"*, *"Zero Client-Side API Keys"*), and the *"Continue with Google"* button.
3. **Trigger Sign-In**: Click the *"Continue with Google"* button (`#google-signin-btn`).
4. **Expected Outcome**: A Google authentication popup appears. Upon choosing your Google account, the user is authenticated, the landing page dismounts, and the private dashboard opens with the user's name and email in the top navigation bar.

### Test Case 2: Writing and Saving a Journal Reflection (Guaranteed Persistence)
1. In the **Journal** tab, locate the title input (`#journal-title-input`) and content area (`#journal-content-textarea`).
2. Select a mood chip (e.g., click *"🙏 Grateful"* or *"🕊️ Peaceful"*).
3. Type a title (e.g., *"Morning Gratitude & Focus"*) and content (e.g., *"Today I woke up feeling clear-headed and ready to tackle project milestones..."*).
4. Add a tag in `#new-tag-input` (e.g., type `clarity` and press Enter).
5. Click **"Save Entry"** (`#save-journal-btn`).
6. **Expected Outcome**: The save button shows a spinner (*"Saving..."*) and then transitions to a green confirmation pill: *"Saved to Firestore"*. The document is persisted in `/users/{userId}/journals/{journalId}`.

### Test Case 3: Generating a Structured AI Summary
1. With content in the journal editor, click the **"AI Summary"** button (`#summarize-btn`).
2. **Expected Outcome**: A loading spinner (*"Summarizing..."*) appears while the server-side Express proxy calls Gemini using the resilient fallback ladder.
3. Once completed, a blue summary container appears displaying:
   - Executive Summary
   - Emotional Tone / Key Themes
   - Mindful Takeaways
   - Next Micro-Steps
4. The summary is automatically saved to the journal document in Firestore and archived in `/users/{userId}/interactions`.

### Test Case 4: Cognitive Brainstorming & Reframing
1. Click the **"Brainstorm"** button (`#brainstorm-btn`).
2. In the modal, optionally type a specific angle or dilemma (e.g., *"How can I reframe my current work deadline positively?"*).
3. Click **"Generate Perspectives"** (`#generate-brainstorm-btn`).
4. **Expected Outcome**: Gemini returns bulleted angles and reframing prompts. Click **"Add to Active Journal"** to append these insights directly to your active journal entry.

### Test Case 5: Multi-Turn Conversation with Gemini Companion & Clean Insertion
1. On the right-hand panel, view the **Gemini Reflection Companion**.
2. Click any of the quick reflection pills (e.g., *"🌱 Help me reflect deeper on this"* or *"💡 What perspective might I be missing?"*), or type a custom prompt in `#chat-input` and press Enter / click Send (`#send-chat-btn`).
3. **Expected Outcome (Markdown Formatting)**: Gemini responds with rich, cleanly rendered Markdown:
   - **Bold text** appears bolded without asterisks (`**text**`).
   - Headings appear with distinct typographic weights and font styling.
   - Bullet points and numbered lists display with proper indentation and bullets.
   - Blockquotes render with a warm bronze border accent.
   - Code snippets render with monospaced badges and code blocks.
4. Click **"+ Insert into Journal"** (`#insert-journal-<id>`) on any Gemini response.
5. **Expected Outcome (Clean Insertion)**: The response is inserted into the journal content area in clean, human-readable format without raw syntax markers (`**`, `###`, `>`).
6. Click **"Formatted Preview"** (`#journal-mode-preview`) in the editor to inspect the rendered journal entry with all Markdown elements styled according to the Sophisticated Dark theme. Click **"Write"** (`#journal-mode-edit`) to return to text editing.

### Test Case 6: Viewing Past Entries and Real-Time Firestore Sync
1. Click the **"Past Entries"** tab (`#nav-tab-history`) in the navigation bar.
2. **Expected Outcome**: The list displays all previously saved reflections with mood badges, timestamps, tags, and summary indicators.
3. Test the search bar (`#journal-search-input`) by typing a keyword or tag.
4. Test the mood filter dropdown (`#journal-mood-filter`).
5. Click on an entry card to reopen and edit it in the Journal Editor.

### Test Case 7: AI Archive / Historical Conversations
1. Click the **"AI Archive"** tab (`#nav-tab-interactions`) in the navigation bar.
2. **Expected Outcome**: The stream displays all user prompts, summaries, brainstorms, and Gemini responses saved in Firestore. Filter by type (*All*, *Conversation*, *Summary*, *Brainstorm*) and use the *"Copy"* button to copy any response.

### Test Case 8: Logout & Session Invalidation
1. Click the **"Sign Out"** button (`#logout-btn`) in the top navigation bar.
2. **Expected Outcome**: The session is cleanly cleared, the private dashboard unmounts, and the user is securely returned to the Landing Page.

### Test Case 9: Real-Time Bidirectional Voice Conversation (Gemini Live API)
1. In the **Gemini Companion** panel, locate and click the **"Voice Chat"** button (`#open-voice-chat-btn`).
2. **Expected Outcome**: The dedicated **Gemini Live Voice Companion** modal opens with the Sophisticated Dark theme, displaying model badge `gemini-3.1-flash-live-preview`.
3. **Microphone Permission Request**: The browser prompts for microphone access only upon launching Voice Chat.
   - If the user denies permission, verify the state transitions gracefully to *"Microphone Permission Denied"* with an instructional message on how to re-enable it in browser settings and a *"Retry Connection"* button (`#retry-voice-btn`).
   - If the user approves permission, the state transitions from *"Connecting to Gemini Live..."* to *"Listening... Speak naturally"*.
4. **Interactive Listening & Visualizer**: Speak a reflection into the microphone (e.g., *"I'm thinking about setting new creative goals this week, but feeling a bit overwhelmed."*).
   - Verify the audio visualizer volume bars dynamically respond to your voice volume.
   - The user's speech is captured in the dialogue stream.
5. **Spoken Audio Response from Gemini**:
   - Gemini Live API processes the audio stream with model `gemini-3.1-flash-live-preview` using prebuilt voice `Zephyr`.
   - The status badge transitions to *"Gemini is speaking..."* with an active audio soundwave animation.
   - The spoken response plays back smoothly through the browser speaker without clipping.
6. **Mute Control**: Click the **"Mute Mic"** button (`#mute-voice-btn`).
   - Verify the icon switches to `MicOff`, the visualizer pauses, and audio input is muted. Click **"Unmute Mic"** to resume.
7. **End Conversation**: Click the **"End Conversation"** button (`#end-voice-btn`).
   - The status transitions to *"Conversation concluded"*. Microphone media tracks are closed and audio playback is cleared.
8. **Save Transcript to Journal**:
   - Click **"Insert into Journal"** (`#save-voice-to-journal-btn`).
   - Verify the full voice dialogue is appended into the active reflection editor in clean readable Markdown (`### 🎙️ Live Voice Reflection Session`), without disturbing existing journal text.
9. **Save to AI Archive**:
   - Click **"Save to AI Archive"** (`#save-voice-to-archive-btn`).
   - The dialogue is persisted to Cloud Firestore under `/users/{userId}/interactions` with type `voice_conversation`.
10. **Close Modal**: Click the **"Close"** button (`#close-voice-modal-btn`) to return cleanly to the main journal interface.

### Test Case 10: Multimodal Image Attachment & Understanding
1. In the **Gemini Companion** panel, click the **"Attach Image"** button (`#attach-image-btn` or the paperclip icon).
2. Select a valid JPG, PNG, or WEBP image file from your device (under 5MB).
3. **Expected Outcome (Image Preview & Validation)**:
   - The thumbnail preview appears immediately inside a subtle dark container above the input field.
   - The image filename and human-readable size (e.g., `42.5 KB`) are displayed.
   - A clear badge indicates the file status.
   - A remove button (`#remove-image-btn`) is available to cancel/remove the image at any time.
4. If a file over 5MB or an unsupported MIME type is selected:
   - A dismissible error banner appears alerting the user with a friendly error message without crashing the application.
5. In the chat input (`#chat-input`), type:
   `Please describe this image and tell me three things you notice.`
6. Click **"Send"** (`#send-chat-btn`).
7. **Expected Outcome (Gemini Image Analysis)**:
   - Gemini processes the multimodal request using the resilient model ladder (`gemini-3.6-flash`).
   - Gemini accurately analyzes the visual content and produces a structured, Markdown-rendered response answering the prompt.
   - The user turn renders a visual badge with the image name and miniature thumbnail.
8. Click **"+ Insert into Journal"** (`#insert-journal-<id>`) on the image analysis response:
   - The inquiry, attached image reference, and Gemini's analysis are appended cleanly to the active journal entry.
9. **Expected Outcome (Isolation & Fallback)**:
   - Remove or clear the image attachment.
   - Send a text-only prompt to confirm standard text chat remains unaffected.
   - Open **Voice Chat** to confirm it remains completely isolated from the companion's image attachment state.

