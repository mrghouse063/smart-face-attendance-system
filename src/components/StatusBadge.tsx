import React from 'react';
import { CheckCircle2, LogIn, LogOut, MinusCircle } from 'lucide-react';

export const EventStatusBadge: React.FC<{ type: 'IN' | 'OUT' }> = ({ type }) => {
  if (type === 'IN') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] whitespace-nowrap shrink-0">
        <LogIn className="w-3.5 h-3.5 text-[#16A34A]" />
        <span>IN</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#991B1B] whitespace-nowrap shrink-0">
      <LogOut className="w-3.5 h-3.5 text-[#DC2626]" />
      <span>OUT</span>
    </span>
  );
};

export const AccountStatusBadge: React.FC<{ status: 'Active' | 'Inactive' }> = ({
  status,
}) => {
  if (status === 'Active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
        <span>Active</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] whitespace-nowrap shrink-0">
      <MinusCircle className="w-3.5 h-3.5 text-[#64748B]" />
      <span>Inactive</span>
    </span>
  );
};
