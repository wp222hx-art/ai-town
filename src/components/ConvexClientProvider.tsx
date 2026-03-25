import { ReactNode } from 'react';
import { ConvexReactClient, ConvexProvider } from 'convex/react';
// import { ConvexProviderWithClerk } from 'convex/react-clerk';
// import { ClerkProvider, useAuth } from '@clerk/clerk-react';

/**
 * Determines the Convex deployment to use.
 *
 * When accessed from an external browser (e.g. sandbox public URL),
 * we rewrite the Convex URL to use the same host with port 3210.
 * This ensures WebSocket connections work from both local and external access.
 */
function convexUrl(): string {
  const url = import.meta.env.VITE_CONVEX_URL as string;
  if (!url) {
    console.error(
      '缺少 VITE_CONVEX_URL 环境变量。' +
      '请在 .env.local 文件中设置。' +
      '运行 `npx convex dev` 可以获取 Convex URL。'
    );
    return 'https://happy-animal-123.convex.cloud';
  }

  // If we're accessing from an external sandbox URL, rewrite the Convex URL
  // to use the sandbox's public proxy for port 3210
  const hostname = window.location.hostname;
  if (hostname.includes('sandbox.novita.ai') || hostname.includes('.e2b.dev')) {
    // Extract the sandbox ID pattern from the current hostname
    // e.g., "5173-isod5fyhlir8z9twwy8yj-a402f90a.sandbox.novita.ai"
    // We need to replace "5173" with "3210"
    const parts = hostname.split('-');
    if (parts.length >= 2) {
      // Replace the port prefix
      const newHost = hostname.replace(/^\d+\-/, '3210-');
      const publicConvexUrl = `https://${newHost}`;
      console.log(`[SYNAPSE] External access detected, using Convex URL: ${publicConvexUrl}`);
      return publicConvexUrl;
    }
  }

  return url;
}

const convex = new ConvexReactClient(convexUrl(), { unsavedChangesWarning: false });

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    // <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}>
    // <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    <ConvexProvider client={convex}>{children}</ConvexProvider>
    // </ConvexProviderWithClerk>
    // </ClerkProvider>
  );
}
