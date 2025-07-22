
'use server'
 
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
 
export async function login(user: any) {
  cookies().set('session', JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // One week
    path: '/',
  })
}
 
export async function logout() {
  // Destroy the session
  cookies().set('session', '', { expires: new Date(0) })
  redirect('/login')
}
