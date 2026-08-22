import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { User, Theme } from '../types.js';
import { executeGraphQL, REGISTER_MUTATION, LOGIN_MUTATION, setAuthToken } from '../lib/graphqlClient.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
  theme?: Theme;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const primaryInputRef = useRef<HTMLInputElement>(null);

  const clearAllInputs = () => {
    setUsername('');
    setEmail('');
    setLoginIdentifier('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setErrorMessage(null);
  };

  const handleClose = () => {
    clearAllInputs();
    onClose();
  };

  // Focus primary input and reset state whenever modal opens or tab changes
  useEffect(() => {
    if (isOpen) {
      clearAllInputs();
      const timer = setTimeout(() => {
        primaryInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTabSwitch = (toRegister: boolean) => {
    setIsRegister(toRegister);
    setErrorMessage(null);
    setShowPassword(false);
    
    // Sync inputs across tabs intelligently
    if (toRegister) {
      if (loginIdentifier.includes('@')) {
        setEmail(loginIdentifier);
      } else if (loginIdentifier && !username) {
        setUsername(loginIdentifier);
      }
    } else {
      if (!loginIdentifier) {
        setLoginIdentifier(email || username);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        const trimmedUsername = username.trim();
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedUsername || trimmedUsername.length < 2) {
          throw new Error('Typist handle must be at least 2 characters');
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
          throw new Error('Username can only contain letters, numbers, hyphens, and underscores');
        }
        if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
          throw new Error('Please enter a valid email address (e.g. you@domain.com)');
        }
        if (!password || password.length < 6) {
          throw new Error('Secret passphrase must be at least 6 characters');
        }
        if (password !== confirmPassword) {
          throw new Error('Passphrases do not match. Please re-check.');
        }

        const data = await executeGraphQL(REGISTER_MUTATION, {
          input: {
            username: trimmedUsername,
            email: trimmedEmail,
            password,
          },
        });

        const { token, user } = data.register;
        setAuthToken(token);
        clearAllInputs();
        onAuthSuccess(user);
        onClose();
      } else {
        const trimmedLogin = loginIdentifier.trim();
        if (!trimmedLogin) {
          throw new Error('Please enter your email or username');
        }
        if (!password) {
          throw new Error('Please enter your passphrase');
        }

        const data = await executeGraphQL(LOGIN_MUTATION, {
          input: {
            login: trimmedLogin,
            password,
          },
        });

        const { token, user } = data.login;
        setAuthToken(token);
        clearAllInputs();
        onAuthSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl border p-6 sm:p-8 shadow-2xl transition-colors ${
          isDark ? 'border-white/10 bg-[#080808]' : 'border-zinc-200 bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          id="btn-close-auth-modal"
          onClick={handleClose}
          type="button"
          aria-label="Close authentication modal"
          className={`absolute right-4 top-4 rounded-lg p-1.5 transition ${
            isDark
              ? 'text-white/40 hover:bg-white/5 hover:text-white'
              : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title & Tabs */}
        <div className="mb-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F27D26]/10 border border-[#F27D26]/30 text-[#F27D26]">
              <Lock className="h-4 w-4" />
            </div>
            <h2 className={`text-2xl font-serif ${isDark ? 'text-white' : 'text-zinc-950'}`}>
              {isRegister ? 'New Typist Registry' : 'Access Credentials'}
            </h2>
          </div>
          <p
            className={`mt-1 text-xs uppercase tracking-[0.15em] ${
              isDark ? 'text-white/40' : 'text-zinc-500'
            }`}
          >
            {isRegister
              ? 'Register credentials to submit records to the global leaderboard'
              : 'Sign in to access your game history and submit challenge scores'}
          </p>

          <div
            className={`mt-4 grid grid-cols-2 gap-1 rounded-xl p-1 border ${
              isDark ? 'bg-[#050505] border-white/10' : 'bg-zinc-100 border-zinc-200'
            }`}
          >
            <button
              id="tab-auth-login"
              type="button"
              onClick={() => handleTabSwitch(false)}
              className={`rounded-lg py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                !isRegister
                  ? 'bg-[#F27D26] text-black shadow-sm'
                  : isDark
                  ? 'text-white/40 hover:text-white'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-auth-register"
              type="button"
              onClick={() => handleTabSwitch(true)}
              className={`rounded-lg py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                isRegister
                  ? 'bg-[#F27D26] text-black shadow-sm'
                  : isDark
                  ? 'text-white/40 hover:text-white'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            className={`mb-4 flex items-center space-x-2 rounded-xl border p-3 text-xs ${
              isDark
                ? 'border-rose-500/40 bg-rose-950/30 text-rose-300'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister ? (
            <>
              <div>
                <label
                  className={`block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1.5 ${
                    isDark ? 'text-white/50' : 'text-zinc-600'
                  }`}
                >
                  Typist Handle (Username)
                </label>
                <div className="relative">
                  <UserIcon
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${
                      isDark ? 'text-white/30' : 'text-zinc-400'
                    }`}
                  />
                  <input
                    ref={primaryInputRef}
                    id="input-reg-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. speedtyper"
                    className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm transition focus:border-[#F27D26] focus:outline-none focus:ring-1 focus:ring-[#F27D26] ${
                      isDark
                        ? 'border-white/10 bg-[#0C0C0C] text-white placeholder-white/25'
                        : 'border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 shadow-xs'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label
                  className={`block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1.5 ${
                    isDark ? 'text-white/50' : 'text-zinc-600'
                  }`}
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${
                      isDark ? 'text-white/30' : 'text-zinc-400'
                    }`}
                  />
                  <input
                    id="input-reg-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="you@domain.com"
                    className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm transition focus:border-[#F27D26] focus:outline-none focus:ring-1 focus:ring-[#F27D26] ${
                      isDark
                        ? 'border-white/10 bg-[#0C0C0C] text-white placeholder-white/25'
                        : 'border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 shadow-xs'
                    }`}
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label
                className={`block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1.5 ${
                  isDark ? 'text-white/50' : 'text-zinc-600'
                }`}
              >
                Email or Typist Handle
              </label>
              <div className="relative">
                <Mail
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${
                    isDark ? 'text-white/30' : 'text-zinc-400'
                  }`}
                />
                <input
                  ref={primaryInputRef}
                  id="input-login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={loginIdentifier}
                  onChange={(e) => {
                    setLoginIdentifier(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="typist@example.com or TypistHandle"
                  className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm transition focus:border-[#F27D26] focus:outline-none focus:ring-1 focus:ring-[#F27D26] ${
                    isDark
                      ? 'border-white/10 bg-[#0C0C0C] text-white placeholder-white/25'
                      : 'border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 shadow-xs'
                  }`}
                />
              </div>
            </div>
          )}

          <div>
            <label
              className={`block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1.5 ${
                isDark ? 'text-white/50' : 'text-zinc-600'
              }`}
            >
              Secret Passphrase
            </label>
            <div className="relative">
              <Lock
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${
                  isDark ? 'text-white/30' : 'text-zinc-400'
                }`}
              />
              <input
                id="input-auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="••••••••"
                className={`w-full rounded-xl border pl-10 pr-11 py-2.5 text-sm transition focus:border-[#F27D26] focus:outline-none focus:ring-1 focus:ring-[#F27D26] ${
                  isDark
                    ? 'border-white/10 bg-[#0C0C0C] text-white placeholder-white/25'
                    : 'border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 shadow-xs'
                }`}
              />
              <button
                type="button"
                id="btn-toggle-password-visibility"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 transition p-1 ${
                  isDark ? 'text-white/30 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'
                }`}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div>
              <label
                className={`block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1.5 ${
                  isDark ? 'text-white/50' : 'text-zinc-600'
                }`}
              >
                Confirm Passphrase
              </label>
              <div className="relative">
                <Lock
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${
                    isDark ? 'text-white/30' : 'text-zinc-400'
                  }`}
                />
                <input
                  id="input-auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border pl-10 pr-11 py-2.5 text-sm transition focus:border-[#F27D26] focus:outline-none focus:ring-1 focus:ring-[#F27D26] ${
                    isDark
                      ? 'border-white/10 bg-[#0C0C0C] text-white placeholder-white/25'
                      : 'border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 shadow-xs'
                  }`}
                />
              </div>
            </div>
          )}

          <button
            id="btn-submit-auth"
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 rounded-xl bg-[#F27D26] py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-md shadow-[#F27D26]/20 hover:bg-[#ff8b38] transition disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>{isRegister ? 'Confirm Registry' : 'Authorize & Enter'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

