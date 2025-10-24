import { auth } from '@/auth';
import { getCurrentUser } from '@/auth/get-user';
import Link from 'next/link';
import { UserNav } from '@/components/user-nav';
import { OrganizationSwitcher } from '@/components/organization-switcher';

export default async function HomePage() {
  const session = await auth();
  const user = session ? await getCurrentUser() : null;
  const isAuthenticated = !!session?.user;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white font-bold text-sm">
              WS
            </div>
            <span className="font-semibold text-lg">Worksafe Now</span>
          </div>
          <div className="flex items-center gap-4">
            {!isAuthenticated ? (
              <>
                <Link href="/auth/signin">
                  <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Sign In
                  </button>
                </Link>
                <Link href="/auth/signup">
                  <button className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
                    Sign Up
                  </button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard">
                  <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Dashboard
                  </button>
                </Link>
                {user?.organization && (
                  <OrganizationSwitcher currentOrg={user.organization} />
                )}
                <UserNav user={session.user} />
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Healthcare Screening,
              <br />
              <span className="text-blue-600">Simplified</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              Coordinate drug tests, physicals, and screening appointments with testing facilities.
              HIPAA-compliant platform for employers and providers.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              {!isAuthenticated ? (
                <>
                  <Link href="/auth/signup">
                    <button className="rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700">
                      Get Started
                    </button>
                  </Link>
                  <Link href="/privacy" className="text-sm font-semibold text-gray-900">
                    Learn more <span aria-hidden="true">→</span>
                  </Link>
                </>
              ) : (
                <Link href="/dashboard">
                  <button className="rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700">
                    Go to Dashboard
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Worksafe Now. HIPAA Compliant.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-900">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-900">
                Terms
              </Link>
              <Link href="/hipaa" className="text-sm text-gray-500 hover:text-gray-900">
                HIPAA
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
