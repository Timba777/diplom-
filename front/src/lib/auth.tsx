import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  isAuthenticated,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  type LoginPayload,
  type RegisterPayload,
  type AuthUser,
} from "./api";

type User = AuthUser;

interface AuthContextType {
  user: User | null;
  isAuth: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored && isAuthenticated()) {
      try {
        setUser(JSON.parse(stored) as User);
      } catch {
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = async (payload: LoginPayload) => {
    const res = await apiLogin(payload);
    setUser(res.user);
    localStorage.setItem("user", JSON.stringify(res.user));
  };

  /** После регистрации backend не отдаёт JWT — выполняем вход теми же учётными данными. */
  const handleRegister = async (payload: RegisterPayload) => {
    await apiRegister(payload);
    const res = await apiLogin({
      email: payload.email,
      password: payload.password,
    });
    setUser(res.user);
    localStorage.setItem("user", JSON.stringify(res.user));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
    apiLogout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuth: !!user && isAuthenticated(),
        loading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
