import { getTenantUrl } from '../src/lib/tenant-url';
import { createSessionHandoffTicket, redeemSessionHandoffTicket } from '../src/lib/auth/session-handoff';

async function verifySubdomainRouting() {
  console.log('=== STARTING TENANT SUBDOMAIN ROUTING VERIFICATION SUITE ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: getTenantUrl helper tests
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- Part 1: Tenant Subdomain URL Generator ---');

  const url1 = getTenantUrl('disaster-sandbox-school', '/login');
  assert(
    url1.includes('disaster-sandbox-school.localhost') && url1.endsWith('/login'),
    `getTenantUrl generates clean subdomain URL: ${url1}`
  );

  const url2 = getTenantUrl('disaster-sandbox-school', '/disaster-sandbox-school/dashboard');
  assert(
    url2.includes('disaster-sandbox-school.localhost') && url2.endsWith('/dashboard'),
    `getTenantUrl defensively strips redundant slug prefix from path: ${url2}`
  );

  const url3 = getTenantUrl('disaster-sandbox-school', '/disaster-sandbox-school');
  assert(
    url3.includes('disaster-sandbox-school.localhost') && !url3.endsWith('/disaster-sandbox-school'),
    `getTenantUrl strips exact redundant slug: ${url3}`
  );

  const url4 = getTenantUrl('disaster-sandbox-school', '');
  assert(
    url4.includes('disaster-sandbox-school.localhost'),
    `getTenantUrl handles empty path: ${url4}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: Cryptographic Session Handoff Engine
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Part 2: Session Handoff Ticket Engine ---');

  const sampleToken = 'test-token-abcdef123456';
  const sampleSlug = 'disaster-sandbox-school';
  const ticket = createSessionHandoffTicket({
    token: sampleToken,
    tenantSlug: sampleSlug,
    nextPath: '/dashboard',
  });

  assert(typeof ticket === 'string' && ticket.includes('.'), 'Ticket generated with payload and signature');

  const redeemed = redeemSessionHandoffTicket(ticket);
  assert(
    redeemed !== null && redeemed.token === sampleToken && redeemed.tenantSlug === sampleSlug,
    'Ticket successfully validated and redeemed'
  );

  const replayAttempt = redeemSessionHandoffTicket(ticket);
  assert(replayAttempt === null, 'Single-use guarantee: Replay redemption rejected');

  const tamperedTicket = ticket.slice(0, -4) + 'zzzz';
  const tamperedResult = redeemSessionHandoffTicket(tamperedTicket);
  assert(tamperedResult === null, 'Tampered ticket signature verification fails');

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: Live HTTP Middleware Routing & Redirect Tests
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Part 3: Live HTTP Middleware Routing Tests ---');

  // Helper to fetch using http.request to guarantee custom Host header is sent over the wire
  function testFetch(path: string, hostHeader: string, options: { method?: string; redirect?: string; headers?: Record<string, string> } = {}): Promise<{ status: number; headers: Headers; text: () => Promise<string> }> {
    return new Promise((resolve, reject) => {
      const http = require('http');
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3000,
        path: path,
        method: options.method || 'GET',
        headers: {
          ...(options.headers || {}),
          Host: hostHeader,
        },
      }, (res: any) => {
        const headers = new Headers();
        for (const [key, val] of Object.entries(res.headers)) {
          if (Array.isArray(val)) {
            val.forEach(v => headers.append(key, v));
          } else if (val) {
            headers.set(key, val as string);
          }
        }
        let data = '';
        res.on('data', (chunk: any) => { data += chunk; });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers,
            text: async () => data,
          });
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  // 3a. Root domain path request MUST 307 redirect to subdomain
  const rootPathRes = await testFetch('/disaster-sandbox-school', 'localhost:3000', {
    redirect: 'manual',
  });
  assert(rootPathRes.status === 307, `Root domain /disaster-sandbox-school returns HTTP 307 (got ${rootPathRes.status})`);
  const rootLocation = rootPathRes.headers.get('location') || '';
  assert(
    rootLocation.includes('http://disaster-sandbox-school.localhost:3000/'),
    `Redirects to subdomain root: ${rootLocation}`
  );

  // 3b. Root domain with deep path MUST 307 redirect to subdomain with deep path
  const rootDashRes = await testFetch('/disaster-sandbox-school/dashboard', 'localhost:3000', {
    redirect: 'manual',
  });
  assert(rootDashRes.status === 307, `Root domain /disaster-sandbox-school/dashboard returns HTTP 307`);
  const rootDashLocation = rootDashRes.headers.get('location') || '';
  assert(
    rootDashLocation.includes('http://disaster-sandbox-school.localhost:3000/dashboard'),
    `Redirects to subdomain dashboard: ${rootDashLocation}`
  );

  // 3c. Redundant slug on subdomain MUST 307 redirect to strip prefix
  const redundantSubRes = await testFetch('/disaster-sandbox-school/dashboard', 'disaster-sandbox-school.localhost:3000', {
    redirect: 'manual',
  });
  assert(redundantSubRes.status === 307, `Subdomain /disaster-sandbox-school/dashboard returns HTTP 307`);
  const redundantLocation = redundantSubRes.headers.get('location') || '';
  assert(
    redundantLocation === '/dashboard' || redundantLocation.endsWith('/dashboard'),
    `Redirects to clean path /dashboard: ${redundantLocation}`
  );

  // 3d. Redundant exact slug on subdomain redirects to /
  const redundantExactRes = await testFetch('/disaster-sandbox-school', 'disaster-sandbox-school.localhost:3000', {
    redirect: 'manual',
  });
  assert(redundantExactRes.status === 307, `Subdomain /disaster-sandbox-school returns HTTP 307`);
  const exactLocation = redundantExactRes.headers.get('location') || '';
  assert(
    exactLocation === '/' || exactLocation.endsWith('.localhost:3000/'),
    `Redirects to clean root /: ${exactLocation}`
  );

  // 3e. Non-tenant platform routes on localhost:3000 MUST NOT be redirected
  const schoolsRes = await testFetch('/schools', 'localhost:3000', {
    redirect: 'manual',
  });
  assert(
    schoolsRes.status === 200,
    `Platform route /schools serves 200 on root domain without redirect (status: ${schoolsRes.status})`
  );

  // 3f. Tenant public landing page on subdomain serves 200 via internal rewrite
  const subHomeRes = await testFetch('/', 'disaster-sandbox-school.localhost:3000', {
    redirect: 'manual',
  });
  assert(
    subHomeRes.status === 200,
    `Tenant home page serves 200 on disaster-sandbox-school.localhost:3000 (status: ${subHomeRes.status})`
  );

  // 3g. Tenant login page on subdomain serves 200 via internal rewrite
  const subLoginRes = await testFetch('/login', 'disaster-sandbox-school.localhost:3000', {
    redirect: 'manual',
  });
  assert(
    subLoginRes.status === 200,
    `Tenant login page serves 200 on disaster-sandbox-school.localhost:3000/login (status: ${subLoginRes.status})`
  );

  // 3h. Tenant results check page on subdomain serves 200 via internal rewrite without redirecting to check.localhost
  const subResultsCheckRes = await testFetch('/results/check', 'disaster-sandbox-school.localhost:3000', {
    redirect: 'manual',
  });
  assert(
    subResultsCheckRes.status === 200,
    `Tenant results check page serves 200 on disaster-sandbox-school.localhost:3000/results/check (status: ${subResultsCheckRes.status})`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // PART 4: Live Session Handoff Route Execution
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Part 4: Live Session Handoff Endpoint Execution ---');

  const handoffToken = 'handoff-live-token-' + Date.now();
  const liveTicket = createSessionHandoffTicket({
    token: handoffToken,
    tenantSlug: 'disaster-sandbox-school',
    nextPath: '/dashboard',
  });

  const handoffRes = await testFetch(
    `/api/tenant/auth/handoff?ticket=${encodeURIComponent(liveTicket)}&next=/dashboard`,
    'disaster-sandbox-school.localhost:3000',
    { redirect: 'manual' }
  );

  assert(handoffRes.status === 307, `Handoff endpoint returns 307 redirect (got ${handoffRes.status})`);
  const handoffRedirect = handoffRes.headers.get('location') || '';
  assert(handoffRedirect.endsWith('/dashboard'), `Handoff redirects to destination: ${handoffRedirect}`);

  const setCookie = handoffRes.headers.get('set-cookie') || '';
  assert(
    setCookie.includes('bms_tenant_session') && setCookie.includes(handoffToken),
    'Handoff endpoint successfully installed bms_tenant_session cookie on subdomain response'
  );

  console.log(`\n=== ALL ${passed}/${total} SUBDOMAIN ROUTING CHECKS PASSED SUCCESSFULLY! ===`);
}

verifySubdomainRouting()
  .catch((err) => {
    console.error('\nVerification failed:', err);
    process.exit(1);
  });
