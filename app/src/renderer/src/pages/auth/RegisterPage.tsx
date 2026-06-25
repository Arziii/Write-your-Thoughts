import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, BookOpen } from 'lucide-react'
import { authService } from '../../services/authService'
import LogoImage from '../../assets/Logo.ico'
import LoginBg from '../../assets/Login.png'
import { useToastStore } from '../../stores/toastStore'

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { addToast } = useToastStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)
    try {
      await authService.signUp(email, password, displayName)
      setSuccess(true)
      addToast('Account created! Check your email to verify.', 'success', 5000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-950">
        <div className="w-full max-w-md text-center animate-fade-in px-8">
          <div className="w-16 h-16 rounded-full bg-success-500/10 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-success-400" />
          </div>
          <h2 className="text-2xl font-bold text-surface-50 mb-2">Almost there!</h2>
          <p className="text-surface-400 mb-6">
            We sent a verification link to <strong className="text-surface-200">{email}</strong>. 
            Please check your inbox and click the link to activate your account.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-lg text-sm transition-all"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="flex h-full relative"
      style={{ backgroundImage: `url(${LoginBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Global dark overlay to ensure readability everywhere */}
      <div className="absolute inset-0 bg-surface-950/75 backdrop-blur-[2px]" />

      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-between p-12 border-r border-surface-800/30 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src={LogoImage} alt="Write Your Thoughts" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg font-semibold text-white drop-shadow-md">Write Your Thoughts</span>
        </div>

        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-light text-white leading-relaxed drop-shadow-md">
            Your stories deserve a home.
          </h2>
          <ul className="space-y-2 text-surface-200 text-sm">
            {[
              'Offline-first — write without internet',
              'Version history — nothing is ever lost',
              'AI polish — your editor, not your author',
              'Sync across all your devices',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 drop-shadow-sm bg-surface-950/20 px-2 py-1 rounded backdrop-blur-sm w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-400 flex-shrink-0 shadow-sm" />
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-surface-300 text-sm drop-shadow-sm font-medium">Free to start. No credit card required.</p>
      </div>

      {/* Right form */}
      <div className="flex flex-1 items-center justify-center px-8 overflow-y-auto py-8 relative z-10">
        <div className="w-full max-w-md animate-fade-in bg-surface-900/60 p-8 rounded-2xl border border-surface-700/50 backdrop-blur-md shadow-2xl">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 flex items-center justify-center">
              <img src={LogoImage} alt="Write Your Thoughts" className="w-full h-full object-contain" />
            </div>
            <span className="text-base font-semibold text-surface-100">Write Your Thoughts</span>
          </div>

          <h1 className="text-2xl font-bold text-surface-50 mb-2">Create your account</h1>
          <p className="text-surface-300 mb-8">Join Write Your Thoughts and start writing.</p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Display Name
              </label>
              <input
                id="register-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoFocus
                className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Email
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Confirm Password
              </label>
              <input
                id="register-confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
              />
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-accent-600 hover:bg-accent-500 disabled:bg-accent-800 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-surface-500">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
