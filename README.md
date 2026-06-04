# Sherlock AI HR Agent (MCP Architecture)

A production-ready HR Operations Assistant that interacts with Google Sheets via the **Model Context Protocol (MCP)**.

## Features
- **Intelligent Reasoning**: Powered by Claude 3.5 Sonnet (or GPT-4o, Gemini 1.5 Pro).
- **Spreadsheet Awareness**: Automatically lists, reads, searches, and filters data across multiple tabs and spreadsheets.
- **MCP Architecture**: Decoupled tool layer using custom Google Sheets MCP server.
- **Premium UI**: Dark mode, glassmorphism, and interactive data tables.
- **Phase 1 Ready**: Operating in Read-Only mode for safe data analysis.

---

## Setup Guide

### 1. Google Cloud Configuration
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named **Sherlock AI Agent**.
3. Enable APIs: **Google Sheets API** and **Google Drive API**.
4. Go to **IAM & Admin > Service Accounts**.
5. Create a Service Account (e.g., `hr-agent`).
6. Click on the account -> **Keys** -> **Add Key** -> **Create New Key (JSON)**.
7. Download the JSON file. You will need `client_email` and `private_key` from it.
8. **IMPORTANT**: Share your Google Sheets with the `client_email` address (e.g., `hr-agent@your-project.iam.gserviceaccount.com`) with **Viewer** permissions.

### 2. Local Installation
```bash
cd sherlock-hr-agent
npm install
```

### 3. Environment Variables
Create a `.env.local` file based on `.env.local.example`:
```env
ANTHROPIC_API_KEY=your_key
AI_PROVIDER=anthropic

GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

### 4. Running the Application
Open two terminals or use a background process:

**Terminal 1: Next.js App**
```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Project Structure
- `mcp-server/`: Independent MCP server wrapping Google Sheets API.
  - `src/google/`: Sheets and Auth client logic.
  - `src/tools/`: Individual tool implementations (Read, Filter, Search, etc).
- `lib/agent/`: AI orchestration logic (providers, prompts, tool mapping).
- `components/`: React UI components for the chat interface and data visualization.
- `app/api/chat/`: Streaming AI route with multi-step tool execution.

---

## Example Commands
- "List all spreadsheets available to you."
- "Show me all tabs in the May 2026 spreadsheet."
- "Find all employees who have missing hours in the 'Staff' sheet."
- "Analyze the allocation for the 'Sherlock' client this month."
- "Are there any duplicate entries in the service sheet?"

---

## Security & Scalability
- **Read-Only Enforced**: System prompt and service account permissions prevent accidental data modification.
- **Modular Tools**: Add new MCP servers (Slack, Notion, etc.) by adding them to `lib/mcp/client.ts`.
- **Validation**: All tool inputs are validated using Zod.
