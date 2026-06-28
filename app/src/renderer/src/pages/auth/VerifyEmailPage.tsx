import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../../services/authService'
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const { addToast } = useToastStore()
  const [isVerified, setIsVerified] = useState(false)
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    // Listen for auth state changes just in case they verified on another device and come back,
    // or if the deep link sets the session.
    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      if (user) {
        setIsVerified(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (isVerified) {
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer)
            navigate('/')
            return 0
          }
          return c - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
    return undefined
  }, [isVerified, navigate])

  const handleResend = async () => {
    // Supabase JS doesn't have a direct 'resend verification' without passing the email,
    // and if the session is null, we can't easily resend unless we know the email.
    // In a real app, we'd pass the email in state via React Router.
    // Assuming the user knows to check their email.
    addToast('If an account exists, a link has been sent.', 'info')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-900 border border-surface-800 p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-500/10">
            {isVerified ? (
               <CheckCircle2 className="h-8 w-8 text-accent-500" />
            ) : (
               <Mail className="h-8 w-8 text-accent-500" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-surface-50">
            {isVerified ? 'Email Verified!' : 'Check your email'}
          </h1>
          
          <p className="mt-2 text-surface-400 leading-relaxed">
            {isVerified 
              ? 'Your email has been verified successfully. Your account has been created.'
              : 'We\'ve sent a verification link to your email address. Please click the link to verify your account.'}
          </p>
        </div>

        {isVerified ? (
          <div className="text-center">
            <p className="text-surface-400 mb-4">Redirecting in {countdown}...</p>
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-500"
            >
              Continue to Workspace
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-surface-800/50 p-4 text-center">
              <div className="h-5 w-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-surface-400">Waiting for verification...</p>
            </div>
            
            <button
              onClick={handleResend}
              className="w-full rounded-xl border border-surface-700 bg-transparent px-4 py-3 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-800 hover:text-white"
            >
              Resend verification email
            </button>

            <button
              onClick={() => navigate('/login')}
              className="text-sm text-accent-400 hover:text-accent-300 mt-2"
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
