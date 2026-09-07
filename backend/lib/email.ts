import { OAuth2Client } from 'google-auth-library'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

let client: OAuth2Client | null = null

function getClient(): OAuth2Client {
  if (client) return client
  client = new OAuth2Client(requireEnv('GMAIL_CLIENT_ID'), requireEnv('GMAIL_CLIENT_SECRET'))
  client.setCredentials({ refresh_token: requireEnv('GMAIL_REFRESH_TOKEN') })
  return client
}

// Email headers are ASCII-only by spec; non-ASCII text (e.g. an em dash)
// must use RFC 2047 encoded-word syntax, unlike the body which just needs
// a Content-Type charset declaration.
function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`
}

function buildRawMessage(to: string, subject: string, html: string): string {
  const from = requireEnv('GMAIL_SENDER')
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\r\n')

  return Buffer.from(message).toString('base64url')
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const { token: accessToken } = await getClient().getAccessToken()
  if (!accessToken) throw new Error('Failed to obtain Gmail access token')

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: buildRawMessage(to, subject, html) }),
    },
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gmail API error (${response.status}): ${body}`)
  }
}
