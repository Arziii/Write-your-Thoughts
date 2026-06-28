import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ArrowLeft, Mail } from 'lucide-react'
import { authService } from '../../services/authService'
import { useToastStore } from '../../stores/toastStore'
import LoginBg from '../../assets/Login.png'
import LogoImage from '../../assets/Logo.ico'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToastStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { error: resetError } = await authService.resetPasswordForEmail(email)
      if (resetError) throw resetError

      setIsSent(true)
      addToast('Password reset link sent to your email.', 'success')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset link.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div 
      className="flex h-full relative"
      style={{ backgroundImage: `url(${LoginBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="hidden lg:flex lg:flex-1 flex-col justify-between p-12 border-r border-surface-800/30 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src={LogoImage} alt="Write Your Thoughts" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg font-semibold text-white drop-shadow-md">Write Your Thoughts</span>
        </div>
        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-light text-white leading-relaxed drop-shadow-md">
            Lost your key to the world?
          </h2>
          <p className="text-surface-300">Don't worry, we'll help you get back in to continue your story.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-8 relative z-10">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="bg-surface-900/90 backdrop-blur-md rounded-2xl p-8 border border-surface-800/50 shadow-2xl">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-surface-50">Reset Password</h1>
              <p className="text-sm text-surface-400 mt-2">Enter your email address and we'll send you a link to reset your password.</p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {isSent ? (
              <div className="text-center">
                <div className="mb-4 flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-accent-500/10">
                  <Mail className="h-8 w-8 text-accent-500" />
                </div>
                <h3 className="text-lg font-medium text-surface-50 mb-2">Check your inbox</h3>
                <p className="text-surface-400 text-sm mb-6">
                  We've sent a password reset link to <strong>{email}</strong>.
                </p>
                <Link
                  to="/login"
                  className="flex w-full justify-center items-center gap-2 rounded-xl bg-surface-800 px-4 py-2.5 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-700 hover:text-white border border-surface-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5" htmlFor="email">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-surface-950/50 border border-surface-700 rounded-xl text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 transition-all"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-accent-600 hover:bg-accent-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 focus:ring-offset-surface-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            )}
            
            {!isSent && (
              <p className="mt-6 text-center text-sm text-surface-400">
                Remembered your password?{' '}
                <Link to="/login" className="font-medium text-accent-400 hover:text-accent-300 transition-colors">
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
