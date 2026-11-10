import http from 'http';

const tenants = [
  { slug: 'brightstar', username: 'admin@brightstar.edu', password: 'Admin123!' },
  { slug: 'beacon', username: 'admin@beacon.edu', password: 'BeaconAdmin123!' },
  { slug: 'apex', username: 'admin@apex.edu', password: 'ApexAdmin123!' },
  { slug: 'crestview', username: 'admin@crestview.edu', password: 'CrestviewAdmin123!' },
  { slug: 'holy-trinity', username: 'admin@holy-trinity.edu', password: 'Admin123!' },
];

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

async function getSessionCookieForTenant(slug: string, username: string, password: string) {
  return new Promise<string | null>((resolve) => {
    const postData = JSON.stringify({ slug, username, password });
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
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const cookies = res.headers['set-cookie'] || [];
          const sessionCookie = cookies.find((c) => c.startsWith('bms_tenant_session='));
          if (sessionCookie) {
            resolve(sessionCookie.split(';')[0]);
          } else {
            console.error(`Login HTTP status ${res.statusCode} for ${slug} (${username}):`, body);
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

async function checkRoute(slug: string, route: string, cookie: string) {
  return new Promise<{ status: number | string; length?: number }>((resolve) => {
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
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode || 500, length: body.length });
        });
      }
    );
    req.on('error', (err) => resolve({ status: 'ERR' }));
    req.end();
  });
}

async function run() {
  console.log('Starting verification of all tenant admin dashboard routes...\n');
  let overallSuccess = true;

  for (const t of tenants) {
    console.log(`--- Testing Tenant: ${t.slug} ---`);
    const cookie = await getSessionCookieForTenant(t.slug, t.username, t.password);
    if (!cookie) {
      console.error(`❌ Could not login to ${t.slug}`);
      overallSuccess = false;
      continue;
    }

    for (const route of routes) {
      const res = await checkRoute(t.slug, route, cookie);
      if (res.status === 200) {
        console.log(`  ✓ GET http://${t.slug}.localhost:3000${route} -> 200 OK (${res.length} bytes)`);
      } else {
        console.error(`  ❌ GET http://${t.slug}.localhost:3000${route} -> ${res.status}`);
        overallSuccess = false;
      }
    }
    console.log('');
  }

  if (overallSuccess) {
    console.log('==============================================');
    console.log('🎉 ALL DASHBOARD ROUTES ARE WORKING PERFECTLY! (200 OK)');
    console.log('==============================================');
    process.exit(0);
  } else {
    console.error('⚠️ Some dashboard routes failed verification.');
    process.exit(1);
  }
}

run();
