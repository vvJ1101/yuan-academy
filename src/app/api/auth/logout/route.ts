import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'


export async function GET() {
  cookies().set('session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
  redirect('/login')
}
