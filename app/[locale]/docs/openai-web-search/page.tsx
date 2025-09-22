"use client";
import * as Tabs from '@radix-ui/react-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from 'next-intl';

export default function OpenAIWebSearchDocsPage() {
  const t = useTranslations('docs.openai');
  return (
    <div className="max-w-none">
      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <h1>{t('title')}</h1>
        <p>{t('intro').replace('web_search', 'web_search')}</p>
      </div>

      <Tabs.Root defaultValue="overview" className="mt-6 block">
        <Tabs.List className="flex w-full gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto">
          <Tabs.Trigger value="overview" className="px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800">{t('tabs.overview')}</Tabs.Trigger>
          <Tabs.Trigger value="flow" className="px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800">{t('tabs.flow')}</Tabs.Trigger>
          <Tabs.Trigger value="code" className="px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800">{t('tabs.code')}</Tabs.Trigger>
          <Tabs.Trigger value="errors" className="px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800">{t('tabs.errors')}</Tabs.Trigger>
          <Tabs.Trigger value="tests" className="px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800">{t('tabs.tests')}</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('overview.featuresTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                <li>{t('overview.li1').replace('web_search', 'web_search')}</li>
                <li>{t('overview.li2')}</li>
                <li>{t('overview.li3')}</li>
                <li>{t('overview.li4')}</li>
              </ul>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <span>{t('overview.webEnabled')}</span>
                <Switch checked disabled aria-readonly />
                <span className="text-zinc-500">{t('overview.demo')}</span>
              </div>
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="flow" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('flow.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal pl-5">
                <li>{t('flow.li1').replace('useWebSearch', 'useWebSearch')}</li>
                <li>{t('flow.li2').replace('Sources consultées', 'Sources consultées')}</li>
                <li>{t('flow.li3').replace('web_search', 'web_search')}</li>
                <li>{t('flow.li4').replace('output_text', 'output_text')}</li>
                <li>{t('flow.li5').replace('chat.completions.create', 'chat.completions.create')}</li>
                <li>{t('flow.li6')}</li>
                <li>{t('flow.li7').replace('AIResponse', 'AIResponse').replace('webSearchSources', 'webSearchSources')}</li>
              </ol>
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="code" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('code.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2">{t('code.call1')}</p>
                <pre className="whitespace-pre-wrap text-sm bg-zinc-50 dark:bg-zinc-900 p-4 rounded-md">{`import { analyzePromptWithOpenAIWebSearch } from "@/lib/openai-web-search";

const result = await analyzePromptWithOpenAIWebSearch(
  "Quels sont les meilleurs outils de monitoring en 2025 ?",
  "BrandWatch",
  ["Mention", "Hootsuite"],
  "fr",
  "gpt-4o-mini"
);

console.log(result.webSearchSources);`}</pre>
              </div>

              <div>
                <p className="mb-2">{t('code.call2')}</p>
                <pre className="whitespace-pre-wrap text-sm bg-zinc-50 dark:bg-zinc-900 p-4 rounded-md">{`import { analyzePromptWithProvider } from "@/lib/ai-utils-enhanced";

const result = await analyzePromptWithProvider(
  "Quels sont les meilleurs outils de monitoring en 2025 ?",
  "OpenAI",
  "BrandWatch",
  ["Mention", "Hootsuite"],
  false, // useMockMode
  true,  // useWebSearch
  "fr"
);`}</pre>
              </div>

              <div>
                <p className="mb-2">{t('code.env')}</p>
                <pre className="whitespace-pre-wrap text-sm bg-zinc-50 dark:bg-zinc-900 p-4 rounded-md">{`# .env.local
OPENAI_API_KEY=sk-...`}</pre>
              </div>
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="errors" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('errors.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-6">
                <li>{t('errors.li1').replace('OPENAI_API_KEY', 'OPENAI_API_KEY')}</li>
                <li>{t('errors.li2').replace('gpt-4o-mini', 'gpt-4o-mini').replace('gpt-4o', 'gpt-4o')}</li>
                <li>{t('errors.li3').replace('invalid_api_key', 'invalid_api_key')}</li>
                <li>{t('errors.li4').replace('empty response', 'empty response')}</li>
                <li>{t('errors.li5')}</li>
              </ul>
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="tests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('tests.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="mb-2">{t('tests.cli')}</p>
                <pre className="whitespace-pre-wrap text-sm bg-zinc-50 dark:bg-zinc-900 p-4 rounded-md">{`npx tsx scripts/test-openai-web-search.ts`}</pre>
              </div>
              <div>
                <p className="mb-2">{t('tests.checks')}</p>
                <ul className="list-disc pl-6">
                  <li>{t('tests.li1').replace('output_text', 'output_text')}</li>
                  <li>{t('tests.li2').replace('webSearchSources', 'webSearchSources')}</li>
                  <li>{t('tests.li3')}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}


