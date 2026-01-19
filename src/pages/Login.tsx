import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, code);

    if (error) {
      toast({
        title: 'Login Gagal',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Login Berhasil',
        description: 'Selamat datang kembali!',
      });
      navigate('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Dark Blue with Tagline */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        
        {/* Glow effect */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <p className="text-lg font-medium mb-4 opacity-90">Tracking Assets Sinergi</p>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-8">
            Track and monitor<br />
            your assets in real-<br />
            time
          </h1>
          <Button 
            variant="outline" 
            className="w-fit bg-transparent border-white text-white hover:bg-white hover:text-primary"
            onClick={() => navigate('/dashboard')}
          >
            Sign in to Dashboard
          </Button>
          <p className="mt-6 text-sm opacity-80">
            Don't have an account? <span className="underline cursor-pointer">Call Admin</span>
          </p>
        </div>

        {/* Bottom status */}
        <div className="absolute bottom-6 left-12 flex items-center gap-2 text-white/80 text-sm">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          Ready to connect (secure connection)
        </div>
      </div>

      {/* Right Side - White Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo/Brand */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-wider text-primary">SINERGI</h1>
            <p className="text-sm text-primary tracking-widest mt-1">MANAJEMEN INDONESIA</p>
          </div>

          {/* Login Form */}
          <div className="space-y-6">
            <p className="text-center text-muted-foreground">Login</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-border"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm text-muted-foreground">
                  Login Code
                </Label>
                <div className="flex gap-3">
                  <Input
                    id="code"
                    type="password"
                    placeholder="User Login Code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-12 flex-1 border-border"
                    required
                  />
                  <Button 
                    type="submit" 
                    className="h-12 px-6" 
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Sign It'
                    )}
                  </Button>
                </div>
              </div>
            </form>

            <p className="text-center text-sm text-muted-foreground pt-4">
              Tidak Bisa Login? Hubungi Admin Sekarang.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
