// One-time local script: run this once to authorize a Gmail sender account
// for the portal's email-sending feature. Opens a URL for you to visit,
// starts a local server to catch the OAuth redirect, and prints the
// resulting refresh token to paste into env vars. Not deployed with the app.
import { createServer } from 'node:http'
import { OAuth2Client } from 'google-auth-library'

const CLIENT_ID = process.argv[2]
const CLIENT_SECRET = process.argv[3]

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Usage: node scripts/gmail-oauth-setup.mjs <client_id> <client_secret>')
  process.exit(1)
}

const server = createServer()
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const redirectUri = `http://localhost:${port}`

const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, redirectUri)
const authUrl = client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
})

console.log('\nOpen this URL in your browser and log in with the Gmail account that should send portal emails:\n')
console.log(authUrl)
console.log('\nWaiting for you to complete the consent screen...\n')

const code = await new Promise((resolve, reject) => {
  server.on('request', (req, res) => {
    const url = new URL(req.url, redirectUri)
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')
    res.end(error ? `Error: ${error}. You can close this tab.` : 'Success! You can close this tab.')
    if (error) reject(new Error(error))
    else if (code) resolve(code)
  })
})

server.close()

const { tokens } = await client.getToken({ code, redirect_uri: redirectUri })

if (!tokens.refresh_token) {
  console.error(
    '\nNo refresh token returned. This Google account may already have an active grant for this app — revoke it at https://myaccount.google.com/permissions and run this script again.',
  )
  process.exit(1)
}

console.log('\nSuccess. Add these to backend/.env and to Vercel env vars:\n')
console.log(`GMAIL_CLIENT_ID="${CLIENT_ID}"`)
console.log(`GMAIL_CLIENT_SECRET="${CLIENT_SECRET}"`)
console.log(`GMAIL_REFRESH_TOKEN="${tokens.refresh_token}"`)
