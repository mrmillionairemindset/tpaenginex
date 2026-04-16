/**
 * Public developer docs page. Renders the OpenAPI spec via RapiDoc
 * (loaded from jsDelivr — pure static asset, no npm bloat).
 *
 * No auth required. Fetches `/api/docs` at render time.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation — TPAEngineX',
  description: 'REST API reference for TPAEngineX integrations',
};

export default function DevelopersPage() {
  return (
    <>
      <script
        type="module"
        src="https://cdn.jsdelivr.net/npm/rapidoc/dist/rapidoc-min.js"
        async
      />
      <div className="min-h-screen bg-background">
        <header className="border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">API Documentation</h1>
            <p className="text-sm text-muted-foreground">
              REST API reference for TPAEngineX integrations
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a
              href="/api/docs"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener"
            >
              Raw JSON
            </a>
            <a
              href="/api/docs?format=yaml"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener"
            >
              YAML
            </a>
          </div>
        </header>
        <div
          style={{
            // RapiDoc is a web component; we use inline attribute string
            // to avoid TypeScript JSX issues with custom elements.
          }}
          dangerouslySetInnerHTML={{
            __html: `
              <rapi-doc
                spec-url="/api/docs"
                render-style="read"
                theme="light"
                show-header="false"
                show-info="true"
                allow-authentication="true"
                allow-server-selection="true"
                allow-try="true"
                allow-spec-url-load="false"
                allow-spec-file-load="false"
                primary-color="#0f172a"
                bg-color="#ffffff"
                text-color="#0f172a"
                nav-bg-color="#f8fafc"
                nav-text-color="#334155"
                regular-font="system-ui, -apple-system, sans-serif"
                mono-font="ui-monospace, SFMono-Regular, Menlo, monospace"
                font-size="default"
                style="height:calc(100vh - 73px); width:100%;"
              ></rapi-doc>
            `,
          }}
        />
      </div>
    </>
  );
}
