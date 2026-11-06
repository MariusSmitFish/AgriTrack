/**
 * Turns thrown errors into a short sentence for the screen.
 * Database codes, HTTP statuses, and other technical text stay in the console.
 */
export function friendlyError(error: unknown, fallback: string) {
  const message = stripDecorations(rawMessage(error))
  const code = rawCode(error)
  const mapped = mapKnown(message, code)

  if (mapped) {
    if (mapped !== message) console.error(error)
    return mapped
  }

  if (!message || looksTechnical(message) || looksLikeBareCode(message)) {
    if (message || code) console.error(error)
    return fallback
  }

  return message
}

function rawMessage(error: unknown) {
  if (typeof error === 'string') return error
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

function rawCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return ''
  const code = (error as { code: unknown }).code
  return typeof code === 'string' || typeof code === 'number' ? String(code) : ''
}

function stripDecorations(message: string) {
  return message
    .replace(/\s*\(HTTP\s*\d+\)\s*/gi, ' ')
    .replace(/\s+[—–-]\s+[a-z0-9_.:-]+\s*$/i, '')
    .replace(/^error:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const TECHNICAL =
  /PGRST\d+|SQLSTATE|\b(?:22|23|42|08|53|57)[0-9A-Z]{3}\b|\bJWT\b|row-level security|\bviolates\b|\bconstraint\b|schema cache|duplicate key|invalid input syntax|null value in column|permission denied|edge function|\bnpx\b|\bBearer\b|TypeError|SyntaxError|ReferenceError|Failed to fetch|NetworkError|Network request failed|\bLoad failed\b|Server error\s*\(|Profile error:|Function misconfigured|Missing authorization|\bat\s+\S+\s+\(|relation ["']|column ["']|\bSQL\b|AuthApiError|Postgrest|\bECONN|fetch failed|\b[a-z]+_[a-z0-9_]{2,}\b|\bHTTP\s*\d+\b|\bUUID\b|postgres|\bstack\b/i

function looksTechnical(message: string) {
  return TECHNICAL.test(message)
}

function looksLikeBareCode(message: string) {
  return /^[A-Za-z0-9_.:/-]+$/.test(message) && (/[_\d]/.test(message) || message.length <= 3)
}

function mapKnown(message: string, code: string) {
  const text = `${code} ${message}`.toLowerCase()

  if (
    /failed to fetch|networkerror|network request failed|load failed|econn|fetch failed|could not reach the/.test(
      text,
    )
  ) {
    return 'Check your internet connection and try again.'
  }

  if (/invalid login credentials|invalid_credentials|invalid_grant/.test(text)) {
    return 'The email or password is incorrect.'
  }
  if (/email not confirmed/.test(text)) {
    return 'Confirm your email, then sign in.'
  }
  if (/already been registered|user already registered|already registered/.test(text)) {
    return 'An account with that email already exists.'
  }
  if (/unable to validate email|invalid email/.test(text)) {
    return 'Enter a valid email address.'
  }
  if (/rate limit|too many requests|over_request_rate_limit|over_email_send_rate_limit/.test(text)) {
    return 'Too many attempts. Wait a few minutes and try again.'
  }
  if (/security purposes|only request this/.test(text)) {
    return 'Wait a minute, then try again.'
  }
  if (/password should be at least/.test(text)) {
    return 'Password must be at least 6 characters.'
  }
  if (/new password should be different|same password/.test(text)) {
    return 'Choose a password you have not used before.'
  }
  if (/otp_expired|token has expired|email link is invalid|expired or is invalid/.test(text)) {
    return 'This link has expired. Request a new one.'
  }
  if (
    /\bjwt\b|session expired|auth session missing|refresh token|not authenticated|unauthorized|missing authorization|invalid claim|caller profile not found/.test(
      text,
    )
  ) {
    return 'Your session has expired. Sign in again.'
  }

  if (/package limit/.test(text)) return message

  if (/row-level security|permission denied|42501|\bforbidden\b|admin role required/.test(text)) {
    return 'You do not have permission to do that.'
  }
  if (/duplicate key|unique constraint|23505/.test(text)) {
    return 'That record already exists.'
  }
  if (/foreign key|23503/.test(text)) {
    return 'This is still linked to other records, so it cannot be removed.'
  }
  if (/null value in column|23502|not-null constraint/.test(text)) {
    return 'A required detail is missing.'
  }
  if (/email and role are required/.test(text)) {
    return 'Enter an email and choose a role.'
  }
  if (/company_id required/.test(text)) {
    return 'Choose a farm for this user.'
  }
  if (/user_id is required/.test(text)) {
    return 'Choose a person to remove.'
  }
  if (/check constraint|23514|invalid input syntax/.test(text)) {
    return 'Some of the details are not valid. Check them and try again.'
  }
  if (/pgrst116|json object requested|multiple \(or no\) rows|cannot coerce the result/.test(text)) {
    return 'That record could not be found.'
  }
  if (
    /schema cache|pgrst202|pgrst204|does not exist|could not find the function|company_plan_usage/.test(
      text,
    )
  ) {
    return 'This feature is not ready yet. Ask a super admin to finish setup.'
  }
  if (/payload too large|entity too large|maximum allowed size|file size limit|\b413\b/.test(text)) {
    return 'That file is too large.'
  }
  if (/mime type is not supported|invalid mime type/.test(text)) {
    return 'That file type is not supported.'
  }
  if (/bucket not found/.test(text)) {
    return 'File storage is not set up yet. Ask a super admin to finish setup.'
  }
  if (/user was not invited/.test(text)) {
    return 'The invitation could not be sent. Check the email and try again.'
  }
  if (/database error|unexpected failure/.test(text)) {
    return 'Something went wrong while saving. Try again.'
  }
  if (/error sending (invite|confirmation|recovery|magic link) email/.test(text)) {
    return 'The email could not be sent. Wait a few minutes and try again.'
  }

  return null
}
