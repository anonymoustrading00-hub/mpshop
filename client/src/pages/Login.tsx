import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();
  const { data: companyConfig } = trpc.settings.getCompanyConfig.useQuery();

  const loginMutation = trpc.auth.loginTraditional.useMutation({
    onSuccess: async () => {
      toast.success("Sesion iniciada correctamente");
      await utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al iniciar sesion");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error("Por favor ingresa tu usuario");
      return;
    }

    if (!password.trim()) {
      toast.error("Por favor ingresa tu contrasena");
      return;
    }

    await loginMutation.mutateAsync({ username, password });
  };

  return (
    <div className="page-shell flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top_right,rgba(2,62,47,0.05),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(2,62,47,0.05),transparent_40%)]">
      <div className="page-container w-full max-w-[440px] mx-auto animate-in fade-in zoom-in duration-500">
        <Card className="overflow-hidden border-none shadow-[0_32px_64px_-16px_rgba(15,23,42,0.15)] bg-white/90 backdrop-blur-xl rounded-[2.5rem]">
          <CardHeader className="space-y-6 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white p-8 sm:p-10 text-center">
              <div className="mx-auto transform transition-transform hover:scale-105 duration-300">
                <img
                  src={companyConfig?.logo || "/logo.png"}
                  alt={companyConfig?.name || "Logo Empresa"}
                  className="mx-auto h-32 w-auto max-w-[240px] object-contain drop-shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {companyConfig?.name || "Bienvenido"}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {companyConfig?.slogan || "Inicia sesión para continuar con tu jornada diaria."}
                </p>
              </div>
            </CardHeader>
 
             <CardContent className="space-y-8 p-8 sm:p-10">
               <form onSubmit={handleSubmit} className="space-y-5">
                 <div className="space-y-2">
                   <Label htmlFor="username" className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Usuario</Label>
                   <Input
                     id="username"
                     type="text"
                     placeholder="nombre de usuario"
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                     disabled={loginMutation.isPending}
                     autoComplete="username"
                     className="h-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all text-base px-4"
                   />
                 </div>
 
                 <div className="space-y-2">
                   <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Contraseña</Label>
                   <div className="relative">
                     <Input
                       id="password"
                       type={showPassword ? "text" : "password"}
                       placeholder="••••••••"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       disabled={loginMutation.isPending}
                       autoComplete="current-password"
                       className="h-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all text-base px-4 pr-12"
                     />
                     <button
                       type="button"
                       onClick={() => setShowPassword(!showPassword)}
                       className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-900"
                       disabled={loginMutation.isPending}
                     >
                       {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                     </button>
                   </div>
                 </div>
 
                 <Button 
                   type="submit" 
                   className="h-13 w-full rounded-2xl bg-slate-900 text-white font-bold text-base shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all active:scale-[0.98] mt-2" 
                   disabled={loginMutation.isPending}
                 >
                   {loginMutation.isPending ? (
                     <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Ingresando...
                     </div>
                   ) : "Iniciar sesión"}
                 </Button>
               </form>
             </CardContent>
 
             <CardFooter className="justify-center border-t border-slate-100 bg-slate-50/30 px-8 py-6 text-center">
               <p className="text-sm text-slate-500">
                 ¿No tienes cuenta?{" "}
                 <Link href="/register" className="font-bold text-slate-900 hover:underline">
                   Regístrate aquí
                 </Link>
               </p>
             </CardFooter>
           </Card>
       </div>
     </div>
  );
}
