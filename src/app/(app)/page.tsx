import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Inicio</CardTitle>
        <CardDescription>
          Ventas del día, stock bajo y pedidos pendientes van a vivir acá (spec 012).
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Por ahora esto es solo el esqueleto de la spec 001: navegación, sesión
        y conexión a la base funcionando.
      </CardContent>
    </Card>
  );
}
