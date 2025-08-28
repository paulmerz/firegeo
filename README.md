# FireGEO: AI-Powered SaaS Starter Kit

<img src="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExNjh4N3VwdGw2YXg2ZXpvMHBlNDFlejd1MjBpZXBxNHZ5YXJxOGk5OSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/x2sTqbCW5m7z0qaNJM/giphy.gif" alt="FireGEO Demo" width="100%" />

FireGEO is a production-ready, open-source SaaS starter kit built with a modern, scalable tech stack. Launch your own SaaS application in minutes with pre-built features like user authentication, subscription billing, AI-powered chat, and an advanced brand monitoring tool.

This starter kit is designed for developers who want to bypass the boilerplate and focus on building unique features. It provides a solid foundation with a zero-configuration setup, letting you go from clone to running application in a single command.

![Next.js](https://img.shields.io/badge/Next.js-15.3-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=flat-square&logo=tailwind-css)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?style=flat-square&logo=postgresql)

## ✨ Features

FireGEO comes with a suite of pre-built features that form the core of a modern SaaS application.

### 🤖 AI-Powered Chat
- **Multi-Provider Support:** Integrated with OpenAI, Anthropic, Google Gemini, and Perplexity.
- **Credit-Based Usage:** Chat functionality is tied to the subscription plan's "message credits," managed by Autumn.
- **Conversation History:** Users can view and manage their past conversations.
- **Streaming Responses:** AI responses are streamed in real-time for a better user experience.

### 📈 AI Brand Monitor
A sophisticated tool to analyze a company's online presence and brand visibility using AI.
- **URL Scraping:** Users enter a URL, and the app scrapes it using Firecrawl to identify the company.
- **Automated Competitor Analysis:** AI identifies and suggests competitors based on the initial company data.
- **Dynamic Prompt Generation:** The system creates tailored questions to analyze the brand against its competitors.
- **Multi-AI Provider Analysis:** Queries multiple AI models to get a comprehensive view of brand perception.
- **In-Depth Reporting:** Visualizes results in a dashboard with a visibility score, comparison matrices, and provider-specific rankings.

### 💳 Subscription Billing
- **Powered by Autumn:** Seamlessly integrates with [Autumn](https://useautumn.com) for subscription management.
- **Stripe Integration:** Autumn handles the complexities of Stripe, including webhooks.
- **Usage-Based & Tiered Plans:** Easily create free, pro, and enterprise plans with usage-based features (e.g., message credits).
- **Customer Portal:** Pre-built integration with Stripe's customer portal for users to manage their subscriptions.

### 🔒 Authentication
- **Powered by Better Auth:** A complete, secure authentication system out of the box.
- **Standard Flows:** Includes sign-up, login, and password reset functionalities.
- **Social Logins (Coming Soon):** Easily extendable for social identity providers.

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | Next.js 15, React 19, TypeScript 5.7 |
| **Styling** | Tailwind CSS v4, shadcn/ui, Lucide Icons |
| **Web Scraping** | Firecrawl |
| **Database** | PostgreSQL, Drizzle ORM |
| **Authentication** | Better Auth |
| **Payments** | Autumn (with Stripe integration) |
| **AI Providers** | OpenAI, Anthropic, Google Gemini, Perplexity |
| **Email** | Resend |

## 🚀 Getting Started

Follow these steps to get your local development environment up and running.

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (You can get one for free from [Supabase](https://supabase.com))

### 1. Clone the Repository

```bash
git clone https://github.com/mendableai/firegeo
cd firegeo
```

### 2. Set Up Environment Variables

Copy the example environment file and fill in your API keys and secrets.

```bash
cp .env.example .env.local
```

You'll need to edit `.env.local` to add your keys. See the **Configuration** section below for a detailed list of all variables. The most important ones to start are `DATABASE_URL` and `BETTER_AUTH_SECRET`.

To generate a `BETTER_AUTH_SECRET`, run:
```bash
openssl rand -base64 32
```

### 3. Automated Setup

Run the automated setup script. This will install dependencies, connect to your database, and run all necessary migrations and initializations.

```bash
npm run setup
```

The script will guide you through the process and let you know if any required keys are missing.

### 4. Run the Development Server

```bash
npm run dev
```

Your application is now running at [http://localhost:3000](http://localhost:3000).

## 🏗️ How It Works (Architecture)

FireGEO is built on a modern, decoupled architecture that is easy to extend.

-   **Frontend:** A Next.js 15 application using React 19 and Tailwind CSS for styling. All UI components are located in the `components/` directory.
-   **Backend:** Next.js API Routes handle all backend logic. These are found in `app/api/`. The backend is responsible for communicating with the database and external services.
-   **Database:** A PostgreSQL database with a schema managed by Drizzle ORM. The schema is defined in `lib/db/schema.ts`.
-   **Authentication:** Handled by `better-auth`, which provides a secure, cookie-based authentication system.
-   **Billing:** `autumn-js` integrates with the Autumn API, which acts as a billing layer on top of Stripe. This decouples your app from Stripe's complexities.
-   **AI & Scraping:** The application communicates with external APIs like Firecrawl and various AI providers to power its core features. API clients and wrappers are in the `lib/` directory.

## ⚙️ Configuration

This section details how to get the necessary API keys and set up the required services.

### Environment Variables

| Variable | Description | Required for |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string. | **Core** |
| `BETTER_AUTH_SECRET` | Secure secret for auth. | **Core** |
| `NEXT_PUBLIC_APP_URL` | Public URL of your app. | **Core** |
| `AUTUMN_SECRET_KEY` | API key from Autumn for billing. | **Billing** |
| `FIRECRAWL_API_KEY` | API key from Firecrawl for scraping. | **Brand Monitor** |
| `RESEND_API_KEY` | API key from Resend for emails. | **Emails** |
| `EMAIL_FROM` | "From" address for sending emails. | **Emails** |
| `OPENAI_API_KEY` | OpenAI API key. | **AI Chat/Brand Monitor** |
| `ANTHROPIC_API_KEY`| Anthropic API key. | **AI Chat/Brand Monitor** |
| `PERPLEXITY_API_KEY`| Perplexity API key. | **AI Chat/Brand Monitor** |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API key. | **AI Chat/Brand Monitor** |

### Service Setup

#### 1. Database (PostgreSQL)
- Create a free PostgreSQL database at [Supabase](https://supabase.com).
- Go to **Settings → Database**.
- Copy the **connection string** (URI) and paste it as your `DATABASE_URL`.

#### 2. Billing (Autumn)
Autumn simplifies Stripe integration for SaaS billing.
1.  **Sign up** at [useautumn.com](https://useautumn.com).
2.  **Get API Key:** In your Autumn dashboard, go to **Settings → Developer** and create an API key. Add it as `AUTUMN_SECRET_KEY`.
3.  **Connect Stripe:** Go to **Integrations → Stripe** and connect your Stripe account.
4.  **Create Features & Products:** The `npm run setup` script can do this for you automatically if you provide your `AUTUMN_SECRET_KEY`. If you want to do it manually, create a "Usage" feature with ID `messages` and products that use this feature.

#### 3. AI & Scraping Providers
- **Firecrawl:** Get your API key from [app.firecrawl.dev](https://app.firecrawl.dev/api-keys).
- **AI Providers:** Get keys from [OpenAI](https://platform.openai.com/api-keys), [Anthropic](https://console.anthropic.com/settings/keys), [Google AI Studio](https://aistudio.google.com/app/apikey), and [Perplexity](https://www.perplexity.ai/settings/api).

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Starts the development server with Turbopack. |
| `npm run build` | Builds the application for production. |
| `npm run start` | Starts the production server. |
| `npm run lint` | Lints the codebase. |
| `npm run setup` | Runs the automated setup wizard. |
| `npm run db:push` | Pushes the Drizzle schema to the database. |
| `npm run db:studio` | Opens the Drizzle Studio GUI to view your data. |
| `npm run db:migrate` | Creates and runs database migrations. |

## Production Deployment

### Deploy to Vercel

The easiest way to deploy is to use Vercel.

```bash
vercel --prod
```

### Configuration
1.  Add all your `.env.local` variables to your Vercel project's environment variables.
2.  Set `NEXT_PUBLIC_APP_URL` to your production domain.
3.  Ensure `NODE_ENV` is set to `production`.

After deploying, you may need to run database migrations if you've made schema changes:
```bash
npm run db:push
```

## Troubleshooting

### Authentication Error: "relation 'user' does not exist"
If you see this error, Better Auth tables haven't been created. Run:
```bash
# Generate Better Auth schema
npx @better-auth/cli generate --config better-auth.config.ts

# Push the schema to database
npm run db:push
```

### Common Issues

- **Auth Issues**: Ensure `BETTER_AUTH_SECRET` is set and matches between deploys
- **Database Errors**: Run `npm run db:push` to sync schema
- **Billing Issues**: Check Autumn products are created with correct IDs
- **Email Failures**: Verify Resend domain and `EMAIL_FROM` address
- **Brand Monitor**: Ensure `FIRECRAWL_API_KEY` is valid

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.