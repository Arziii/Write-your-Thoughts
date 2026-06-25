import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { authService } from '../../services/authService'
import LogoImage from '../../assets/Logo.ico'
import LoginBg from '../../assets/Login.png'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToastStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await authService.signIn(email, password)
      addToast('Welcome back!', 'success')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in'
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

        <div className="relative z-10 space-y-6">
          <blockquote className="text-3xl font-light text-white leading-relaxed drop-shadow-md">
            "The writer creates. The AI refines. The original work is always preserved."
          </blockquote>
          <div className="flex gap-2">
            {['Writing', 'Editing', 'Polishing', 'Publishing'].map((stage, i) => (
              <span
                key={stage}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium shadow-sm',
                  i === 0
                    ? 'bg-accent-600 text-white'
                    : 'bg-surface-800/80 text-surface-200 backdrop-blur-sm'
                )}
              >
                {stage}
              </span>
            ))}
          </div>
        </div>

        <p className="text-surface-300 text-sm drop-shadow-sm">
          Your personal writing environment for novelists.
        </p>
      </div>

      {/* Right login form */}
      <div className="flex flex-1 items-center justify-center px-8 relative z-10">
        <div className="w-full max-w-md animate-fade-in bg-surface-900/60 p-8 rounded-2xl border border-surface-700/50 backdrop-blur-md shadow-2xl">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 flex items-center justify-center">
              <img src={LogoImage} alt="Write Your Thoughts" className="w-full h-full object-contain" />
            </div>
            <span className="text-base font-semibold text-surface-100">Write Your Thoughts</span>
          </div>

          <h1 className="text-2xl font-bold text-surface-50 mb-2">Welcome back</h1>
          <p className="text-surface-300 mb-8">Sign in to continue your writing journey.</p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-accent-600 hover:bg-accent-500 disabled:bg-accent-800 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-surface-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
