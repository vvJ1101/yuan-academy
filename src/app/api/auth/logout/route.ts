import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'


export async function GET() {
  const cookieStore = await cookies()
  cookieStore.set('session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
  redirect('/login')
}
