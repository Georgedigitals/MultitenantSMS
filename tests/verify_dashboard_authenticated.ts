import http from 'http';

const slugs = ['brightstar', 'beacon', 'apex', 'crestview', 'holy-trinity'];

const routes = [
  '/dashboard',
  '/dashboard/students',
  '/dashboard/staff',
  '/dashboard/subjects',
  '/dashboard/assignments',
  '/dashboard/results',
  '/dashboard/results/report-cards',
  '/dashboard/attendance',
  '/dashboard/cbt',
  '/dashboard/fees',
  '/dashboard/transport',
  '/dashboard/sms',
  '/dashboard/whatsapp',
  '/dashboard/grading',
  '/dashboard/promotion',
  '/dashboard/website',
];

async function loginTenant(slug: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const postData = JSON.stringify({
      slug,
      username: 'admin',
      password: 'Admin123!',
    });

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/tenant/auth/login',
        method: 'POST',
        headers: {
          Host: `${slug}.localhost:3000`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          if (setCookie && setCookie.length > 0) {
            const sessionCookie = setCookie.find((c) => c.startsWith('bms_tenant_session='));
            if (sessionCookie) {
              resolve(sessionCookie.split(';')[0]);
              return;
            }
          }
          console.error(`Login failed for ${slug}: status ${res.statusCode}, body: ${body}`);
          resolve(null);
        });
      }
    );
    req.on('error', (err) => {
      console.error(`Login error for ${slug}: ${err.message}`);
      resolve(null);
    });
    req.write(postData);
    req.end();
  });
}

async function testRoute(slug: string, route: string, cookie: string): Promise<number> {
  return new Promise<number>((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: route,
        method: 'GET',
        headers: {
          Host: `${slug}.localhost:3000`,
          Cookie: cookie,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          resolve(res.statusCode || 500);
        });
      }
    );
    req.on('error', () => resolve(500));
    req.end();
  });
}

async function main() {
  console.log('--- Verifying Authenticated Tenant Dashboard Routes via HTTP ---');
  let failures = 0;
  let passed = 0;
  const totalExpected = slugs.length * routes.length;

  for (const slug of slugs) {
    console.log(`\n[${slug}] Logging in...`);
    const cookie = await loginTenant(slug);
    if (!cookie) {
      console.error(`❌ Could not authenticate tenant: ${slug}`);
      failures += routes.length;
      continue;
    }

    for (const route of routes) {
      const status = await testRoute(slug, route, cookie);
      if (status === 200) {
        console.log(`[${slug}] GET ${route} -> 200 OK`);
        passed++;
      } else {
        console.error(`[${slug}] GET ${route} -> ${status} FAILED`);
        failures++;
      }
    }
  }

  console.log(`\n==============================================`);
  console.log(`PASSED: ${passed}/${totalExpected} routes (200 OK)`);
  console.log(`==============================================`);

  if (failures === 0) {
    console.log('🎉 ALL DASHBOARD ROUTE ENDPOINTS ACCESSIBLE WITH STATUS 200 OK!');
    process.exit(0);
  } else {
    console.error(`❌ ${failures} endpoints failed verification.`);
    process.exit(1);
  }
}

main();
