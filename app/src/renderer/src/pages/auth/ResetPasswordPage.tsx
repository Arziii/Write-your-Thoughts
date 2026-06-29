import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, KeyRound, Eye, EyeOff } from 'lucide-react'
import { authService } from '../../services/authService'
import { useToastStore } from '../../stores/toastStore'
import LoginBg from '../../assets/Login.png'
import LogoImage from '../../assets/Logo.ico'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
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
      const { error: updateError } = await authService.updatePassword(password)
      if (updateError) throw updateError

      addToast('Password has been updated successfully.', 'success')
      navigate('/') // Go to workspace since they are authenticated
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password.'
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
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-8 relative z-10">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="bg-surface-900/90 backdrop-blur-md rounded-2xl p-8 border border-surface-800/50 shadow-2xl">
            <div className="mb-8 text-center flex flex-col items-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/10">
                <KeyRound className="h-6 w-6 text-accent-500" />
              </div>
              <h1 className="text-2xl font-bold text-surface-50">Set New Password</h1>
              <p className="text-sm text-surface-400 mt-2">Please enter your new password below.</p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5" htmlFor="password">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-surface-950/50 border border-surface-700 rounded-xl text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 transition-all pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-surface-400 hover:text-surface-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-surface-950/50 border border-surface-700 rounded-xl text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 transition-all pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-surface-400 hover:text-surface-200 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-accent-600 hover:bg-accent-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 focus:ring-offset-surface-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
