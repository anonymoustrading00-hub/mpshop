import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type BranchSwitchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetBranch: { id: number; name: string } | null;
  onConfirm: () => void;
};

export function BranchSwitchDialog({
  open,
  onOpenChange,
  targetBranch,
  onConfirm,
}: BranchSwitchDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyAdminMutation = trpc.auth.verifyAdminCredentials.useMutation({
    onSuccess: (data) => {
      if (data.valid) {
        toast.success("Autorización exitosa. Cambiando de sucursal...");
        onConfirm();
        handleClose();
      } else {
        toast.error(data.message || "Credenciales inválidas");
      }
      setIsVerifying(false);
    },
    onError: (error) => {
      toast.error(error.message || "Error al verificar credenciales");
      setIsVerifying(false);
    },
  });

  const handleClose = () => {
    setUsername("");
    setPassword("");
    setIsVerifying(false);
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Por favor ingresa usuario y contraseña");
      return;
    }
    setIsVerifying(true);
    verifyAdminMutation.mutate({ username, password });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <Lock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Autorización Requerida</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Solo administradores pueden cambiar de sucursal
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              {targetBranch ? (
                <>
                  Estás intentando cambiar a la sucursal{" "}
                  <strong className="font-bold">{targetBranch.name}</strong>. Ingresa las
                  credenciales de un administrador para continuar.
                </>
              ) : (
                "Ingresa las credenciales de un administrador para continuar."
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isVerifying}
                autoComplete="username"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isVerifying}
                autoComplete="current-password"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isVerifying}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isVerifying}>
              {isVerifying ? "Verificando..." : "Autorizar Cambio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
