import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { Registration } from "@/lib/types";

export function RegistrationsTable({ registrations }: { registrations: Registration[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>First Name</TableHead>
            <TableHead>Last Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Tech Skill</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                No registrations yet.
              </TableCell>
            </TableRow>
          ) : (
            registrations.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{r.firstName}</TableCell>
                <TableCell>{r.lastName}</TableCell>
                <TableCell className="whitespace-nowrap">{r.phone}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.techSkill}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}