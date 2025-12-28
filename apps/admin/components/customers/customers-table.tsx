"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Customer } from "@/lib/types/customers";
import { DateTime } from "../orders/date-time";

interface CustomersTableProps {
  customers: Customer[];
}

/**
 * Table component for displaying customers list
 */
export function CustomersTable({ customers }: CustomersTableProps) {
  return (
    <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>GSTIN</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <CustomerTableRow key={customer.id} customer={customer} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface CustomerTableRowProps {
  customer: Customer;
}

/**
 * Single row component for customers table
 */
function CustomerTableRow({ customer }: CustomerTableRowProps) {
  return (
    <TableRow className="group hover:bg-muted/30 transition-colors">
      <TableCell className="font-medium text-xs">{customer.name}</TableCell>
      <TableCell className="text-xs">{customer.email}</TableCell>
      <TableCell className="text-xs">{customer.phone}</TableCell>
      <TableCell className="text-xs">{customer.gstin || "-"}</TableCell>
      <TableCell className="text-xs">
        <DateTime date={customer.createdAt} />
      </TableCell>
    </TableRow>
  );
}
