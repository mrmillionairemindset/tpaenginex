import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SAML SSO Setup — TPAEngineX',
  description: 'Configure SAML single sign-on between your identity provider and TPAEngineX.',
};

function getExternalUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://app.tpaplatform.com').replace(/\/$/, '');
}

export default function SsoSetupDocsPage() {
  const externalUrl = getExternalUrl();
  const acsUrl = `${externalUrl}/api/sso/saml/acs`;
  const entityId = externalUrl;
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SAML SSO Setup</h1>
        <p className="mt-2 text-muted-foreground">
          TPAEngineX supports SAML 2.0 SSO for enterprise customers. The instructions
          below walk you through wiring your identity provider (IdP) up as a trusted
          source of identity for your TPA tenant.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Service Provider details</h2>
        <p className="text-sm text-muted-foreground">
          Use these values when configuring a new SAML application in your IdP:
        </p>
        <dl className="rounded-lg border p-4 text-sm space-y-2">
          <div className="grid grid-cols-[220px_1fr] gap-2">
            <dt className="font-medium">ACS (Reply) URL</dt>
            <dd><code className="bg-muted px-1.5 py-0.5 rounded">{acsUrl}</code></dd>
          </div>
          <div className="grid grid-cols-[220px_1fr] gap-2">
            <dt className="font-medium">Entity ID / Audience URI</dt>
            <dd><code className="bg-muted px-1.5 py-0.5 rounded">{entityId}</code></dd>
          </div>
          <div className="grid grid-cols-[220px_1fr] gap-2">
            <dt className="font-medium">Name ID format</dt>
            <dd><code className="bg-muted px-1.5 py-0.5 rounded">urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</code></dd>
          </div>
          <div className="grid grid-cols-[220px_1fr] gap-2">
            <dt className="font-medium">Signature algorithm</dt>
            <dd><code className="bg-muted px-1.5 py-0.5 rounded">RSA-SHA256</code></dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          Required SAML attribute assertions: <code>email</code>, <code>firstName</code>, <code>lastName</code>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Okta</h2>
        <ol className="list-decimal pl-5 text-sm space-y-1.5">
          <li>In the Okta Admin Console, go to <strong>Applications → Create App Integration → SAML 2.0</strong>.</li>
          <li>Name: <em>TPAEngineX</em> (or your TPA name).</li>
          <li>Single sign-on URL: <code className="bg-muted px-1 rounded">{acsUrl}</code></li>
          <li>Audience URI (SP Entity ID): <code className="bg-muted px-1 rounded">{entityId}</code></li>
          <li>Name ID format: <strong>EmailAddress</strong>.</li>
          <li>
            Add attribute statements:
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li><code>email</code> → <code>user.email</code></li>
              <li><code>firstName</code> → <code>user.firstName</code></li>
              <li><code>lastName</code> → <code>user.lastName</code></li>
            </ul>
          </li>
          <li>Finish the wizard and download the <strong>IdP metadata XML</strong>.</li>
          <li>In TPAEngineX go to <strong>Settings → SSO → Add SSO Connection</strong> and upload the XML.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Azure Active Directory</h2>
        <ol className="list-decimal pl-5 text-sm space-y-1.5">
          <li>Go to <strong>Enterprise Applications → New application → Create your own application</strong>.</li>
          <li>Choose <strong>Integrate any other application you don&apos;t find in the gallery (Non-gallery)</strong>.</li>
          <li>Open <strong>Single sign-on → SAML</strong>.</li>
          <li>Identifier (Entity ID): <code className="bg-muted px-1 rounded">{entityId}</code></li>
          <li>Reply URL: <code className="bg-muted px-1 rounded">{acsUrl}</code></li>
          <li>
            Configure the user claims to emit <code>email</code>, <code>firstName</code>, and <code>lastName</code> attributes
            (rename the default claims or add new ones pointing at <code>user.mail</code>, <code>user.givenname</code>, <code>user.surname</code>).
          </li>
          <li>Download the <strong>Federation Metadata XML</strong>.</li>
          <li>In TPAEngineX go to <strong>Settings → SSO → Add SSO Connection</strong> and upload the XML.</li>
          <li>Back in Azure, assign the users/groups that should have access.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Google Workspace</h2>
        <ol className="list-decimal pl-5 text-sm space-y-1.5">
          <li>Go to <strong>Admin Console → Apps → Web and mobile apps → Add app → Add custom SAML app</strong>.</li>
          <li>Name it <em>TPAEngineX</em>, continue to SAML details.</li>
          <li>Download the Google <strong>IdP metadata</strong> (you&apos;ll upload this to TPAEngineX).</li>
          <li>ACS URL: <code className="bg-muted px-1 rounded">{acsUrl}</code></li>
          <li>Entity ID: <code className="bg-muted px-1 rounded">{entityId}</code></li>
          <li>Name ID format: <strong>EMAIL</strong>.</li>
          <li>
            Add attribute mapping:
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li>Primary email → <code>email</code></li>
              <li>First name → <code>firstName</code></li>
              <li>Last name → <code>lastName</code></li>
            </ul>
          </li>
          <li>Finish and turn the app ON for everyone (or selected OUs).</li>
          <li>In TPAEngineX go to <strong>Settings → SSO → Add SSO Connection</strong> and upload the Google metadata.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">After configuration</h2>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>
            Click <strong>Test</strong> on your new connection in Settings → SSO. This verifies the metadata
            was registered with our SAML engine successfully.
          </li>
          <li>
            On the sign-in page users can click <strong>Sign in with SSO</strong>, enter their work email,
            and will be redirected to your IdP.
          </li>
          <li>
            Just-in-time provisioning can be enabled per-connection. New users authenticated through
            the IdP will be auto-created with the default role you configure.
          </li>
          <li>
            For security, set an <strong>allowed email domain list</strong> so only users at your domain
            can log in via that connection.
          </li>
        </ul>
      </section>
    </div>
  );
}
