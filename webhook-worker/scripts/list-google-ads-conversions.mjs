#!/usr/bin/env node
/**
 * After OAuth secrets exist, list accessible customers + conversion actions
 * so you can build GOOGLE_ADS_CONV_ACTIONS.
 *
 * Usage:
 *   GOOGLE_ADS_CLIENT_ID=... \
 *   GOOGLE_ADS_CLIENT_SECRET=... \
 *   GOOGLE_ADS_REFRESH_TOKEN=... \
 *   GOOGLE_ADS_DEVELOPER_TOKEN=... \
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID=... \   # optional MCC
 *   node scripts/list-google-ads-conversions.mjs
 *
 * Or pass --customer=1234567890 to skip discovery and only list actions.
 */

const API = 'https://googleads.googleapis.com/v19';

async function getAccessToken(env) {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.GOOGLE_ADS_CLIENT_ID,
        client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
        refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
    });
    const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const j = await r.json();
    if (!r.ok || !j.access_token) {
        throw new Error(`oauth failed: ${JSON.stringify(j)}`);
    }
    return j.access_token;
}

function headers(accessToken, env) {
    const h = {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN,
        'Content-Type': 'application/json',
    };
    if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
        h['login-customer-id'] = String(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/-/g, '');
    }
    return h;
}

async function listAccessibleCustomers(accessToken, env) {
    const r = await fetch(`${API}/customers:listAccessibleCustomers`, {
        headers: headers(accessToken, env),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`listAccessibleCustomers: ${JSON.stringify(j)}`);
    return (j.resourceNames || []).map((n) => n.replace('customers/', ''));
}

async function listConversionActions(accessToken, env, customerId) {
    const cid = String(customerId).replace(/-/g, '');
    const query = `
      SELECT
        conversion_action.id,
        conversion_action.name,
        conversion_action.type,
        conversion_action.status,
        conversion_action.resource_name,
        conversion_action.tag_snippets
      FROM conversion_action
      WHERE conversion_action.status != 'REMOVED'
      ORDER BY conversion_action.name
    `;
    const r = await fetch(`${API}/customers/${cid}/googleAds:searchStream`, {
        method: 'POST',
        headers: headers(accessToken, env),
        body: JSON.stringify({ query }),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`searchStream ${cid}: ${text.slice(0, 500)}`);
    // searchStream returns NDJSON / JSON array depending on version — handle both
    let rows = [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            for (const chunk of parsed) {
                for (const row of chunk.results || []) rows.push(row);
            }
        } else if (parsed.results) {
            rows = parsed.results;
        }
    } catch (_) {
        // NDJSON
        for (const line of text.split('\n')) {
            if (!line.trim()) continue;
            try {
                const chunk = JSON.parse(line);
                for (const row of chunk.results || []) rows.push(row);
            } catch (_) {}
        }
    }
    return rows.map((row) => row.conversionAction).filter(Boolean);
}

function matchHint(action) {
    const name = (action.name || '').toLowerCase();
    const snippets = JSON.stringify(action.tagSnippets || action.tag_snippets || []).toLowerCase();
    if (name.includes('send') && (name.includes('desktop') || name.includes('computer'))) {
        return 'send_to_desktop';
    }
    if (snippets.includes('1x2-col5tnqceknv1j5e') || snippets.includes('1x2-col5')) {
        return 'send_to_desktop';
    }
    if (name.includes('download') || name.includes('request quote') || name.includes('trial')) {
        return 'trial_download';
    }
    if (snippets.includes('h-gbcktnnuceknv1j5e') || snippets.includes('h-gbck')) {
        return 'trial_download';
    }
    if (name.includes('checkout') || name.includes('purchase') || name.includes('buy')) {
        return 'checkout_clicked';
    }
    return null;
}

async function main() {
    const env = process.env;
    for (const k of [
        'GOOGLE_ADS_CLIENT_ID',
        'GOOGLE_ADS_CLIENT_SECRET',
        'GOOGLE_ADS_REFRESH_TOKEN',
        'GOOGLE_ADS_DEVELOPER_TOKEN',
    ]) {
        if (!env[k]) {
            console.error(`Missing env ${k}`);
            process.exit(1);
        }
    }

    const argCustomer = (process.argv.find((a) => a.startsWith('--customer=')) || '').split('=')[1];
    const accessToken = await getAccessToken(env);

    let customers = argCustomer ? [argCustomer] : await listAccessibleCustomers(accessToken, env);
    console.log('\nAccessible customers:', customers.join(', ') || '(none)');

    const suggested = {};
    for (const cid of customers) {
        console.log(`\n── Conversion actions for ${cid} ──`);
        let actions;
        try {
            actions = await listConversionActions(accessToken, env, cid);
        } catch (e) {
            console.log(`  (skip) ${e.message}`);
            continue;
        }
        if (!actions.length) {
            console.log('  (none)');
            continue;
        }
        for (const a of actions) {
            const hint = matchHint(a);
            const mark = hint ? `  ← likely ${hint}` : '';
            console.log(`  ${a.resourceName || a.resource_name}`);
            console.log(`    name=${a.name}  type=${a.type}  status=${a.status}${mark}`);
            if (hint && !suggested[hint]) {
                suggested[hint] = a.resourceName || a.resource_name;
            }
        }
    }

    if (Object.keys(suggested).length) {
        console.log('\nSuggested GOOGLE_ADS_CONV_ACTIONS JSON:\n');
        console.log(JSON.stringify(suggested, null, 2));
        console.log('\nSet with:\n  npx wrangler secret put GOOGLE_ADS_CONV_ACTIONS\n');
    } else {
        console.log('\nNo automatic mapping guessed — copy resource names manually into GOOGLE_ADS_CONV_ACTIONS.');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
