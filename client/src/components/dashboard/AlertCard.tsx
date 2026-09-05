import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, AlertCircle, Info } from "lucide-react";

interface AlertCardProps {
  type: "success" | "warning" | "error" | "info" | string;
  title: string;
  description: string;
}

const ALERT_CONFIG: Record<string, { bg: string; icon: any; iconColor: string; titleColor: string; descColor: string }> = {
  success: {
    bg: "bg-emerald-50 border-emerald-200",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    titleColor: "text-emerald-900",
    descColor: "text-emerald-700",
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    titleColor: "text-amber-900",
    descColor: "text-amber-700",
  },
  error: {
    bg: "bg-red-50 border-red-200",
    icon: AlertCircle,
    iconColor: "text-red-600",
    titleColor: "text-red-900",
    descColor: "text-red-700",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    icon: Info,
    iconColor: "text-blue-600",
    titleColor: "text-blue-900",
    descColor: "text-blue-700",
  },
};

export function AlertCard({ type, title, description }: AlertCardProps) {
  const config = ALERT_CONFIG[type] || ALERT_CONFIG.info || ALERT_CONFIG.warning;
  const Icon = config?.icon || Info;

  return (
    <Card className={`${config.bg} border rounded-xl shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-white/50 ${config.iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${config.titleColor} leading-tight`}>{title}</p>
            <p className={`text-xs ${config.descColor} mt-1`}>{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
